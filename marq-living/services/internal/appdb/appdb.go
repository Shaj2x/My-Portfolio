// Package appdb is the ingest service's narrow interface to the Supabase
// database: device presence, device events and laundry state. Writes go
// through the same tables the app reads, so triggers (fault → ticket,
// laundry announcement, notifications) run exactly as for any other client.
package appdb

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool

	mu       sync.Mutex
	presence map[string]Presence
}

type Presence struct {
	LastSeen   time.Time
	FW         *string
	RSSI       *int
	BatteryPct *int
}

func New(pool *pgxpool.Pool) *DB { return &DB{Pool: pool, presence: map[string]Presence{}} }

// Touch records device activity; FlushPresence writes it in one batch.
func (d *DB) Touch(deviceID string, p Presence) {
	d.mu.Lock()
	defer d.mu.Unlock()
	cur := d.presence[deviceID]
	if p.LastSeen.After(cur.LastSeen) {
		cur.LastSeen = p.LastSeen
	}
	if p.FW != nil {
		cur.FW = p.FW
	}
	if p.RSSI != nil {
		cur.RSSI = p.RSSI
	}
	if p.BatteryPct != nil {
		cur.BatteryPct = p.BatteryPct
	}
	d.presence[deviceID] = cur
}

func (d *DB) FlushPresence(ctx context.Context) error {
	d.mu.Lock()
	batch := d.presence
	d.presence = map[string]Presence{}
	d.mu.Unlock()
	if len(batch) == 0 {
		return nil
	}
	ids := make([]string, 0, len(batch))
	seen := make([]time.Time, 0, len(batch))
	fws := make([]*string, 0, len(batch))
	rssi := make([]*int32, 0, len(batch))
	bat := make([]*int32, 0, len(batch))
	for id, p := range batch {
		ids = append(ids, id)
		seen = append(seen, p.LastSeen)
		fws = append(fws, p.FW)
		rssi = append(rssi, i32(p.RSSI))
		bat = append(bat, i32(p.BatteryPct))
	}
	_, err := d.Pool.Exec(ctx, `
		update public.devices d set
		  last_seen = greatest(coalesce(d.last_seen, u.seen), u.seen),
		  status = case when d.status = 'provisioning' then 'online'::public.device_status else d.status end,
		  firmware_version = coalesce(u.fw, d.firmware_version),
		  rssi_dbm = coalesce(u.rssi::int2, d.rssi_dbm),
		  battery_pct = coalesce(u.bat::int2, d.battery_pct)
		from unnest($1::uuid[], $2::timestamptz[], $3::text[], $4::int4[], $5::int4[]) as u(id, seen, fw, rssi, bat)
		where d.id = u.id`, ids, seen, fws, rssi, bat)
	if err != nil {
		// Put the batch back so it's retried.
		d.mu.Lock()
		for id, p := range batch {
			if _, ok := d.presence[id]; !ok {
				d.presence[id] = p
			}
		}
		d.mu.Unlock()
	}
	return err
}

func i32(p *int) *int32 {
	if p == nil {
		return nil
	}
	v := int32(*p)
	return &v
}

// Event inserts a device_events row. Triggers turn faults/anomalies/offline
// into tickets, staff alerts and (laundry) announcements.
func (d *DB) Event(ctx context.Context, deviceID, typ string, at time.Time, payload map[string]any) error {
	b, _ := json.Marshal(payload)
	_, err := d.Pool.Exec(ctx, `insert into public.device_events (device_id, type, payload, occurred_at)
		values ($1, $2::public.device_event_type, $3, $4)`, deviceID, typ, b, at)
	return err
}

type Machine struct {
	ID        string
	Label     string
	Kind      string
	DeviceID  string
	Channel   int
	State     string
	Signature []byte
}

func (d *DB) Machines(ctx context.Context) ([]Machine, error) {
	rows, err := d.Pool.Query(ctx, `select id::text, label, kind::text, device_id::text, coalesce(channel, 0), state::text, signature
		from public.laundry_machines where device_id is not null`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Machine
	for rows.Next() {
		var m Machine
		if err := rows.Scan(&m.ID, &m.Label, &m.Kind, &m.DeviceID, &m.Channel, &m.State, &m.Signature); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// SetMachineState updates availability. Moving to idle from a cycle notifies
// tenants waiting for a machine (laundry_machine_freed). Returns the number
// of people notified.
func (d *DB) SetMachineState(ctx context.Context, id, state string, at time.Time, estDone *time.Time) (int, error) {
	var prev string
	err := d.Pool.QueryRow(ctx, `
		with old as (select state from public.laundry_machines where id = $1 for update)
		update public.laundry_machines m set state = $2::public.machine_state, state_since = $3, est_done_at = $4
		  from old where m.id = $1 and m.state <> 'fault'
		returning old.state::text`, id, state, at, estDone).Scan(&prev)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil // unknown or faulted machine: staff resolve faults
	}
	if err != nil {
		return 0, err
	}
	if state == "idle" && (prev == "running" || prev == "finishing") {
		var n int
		err = d.Pool.QueryRow(ctx, `select public.laundry_machine_freed($1)`, id).Scan(&n)
		return n, err
	}
	return 0, nil
}
