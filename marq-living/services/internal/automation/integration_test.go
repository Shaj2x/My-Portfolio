//go:build integration

package automation

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/jackc/pgx/v5/pgxpool"
	mochi "github.com/mochi-mqtt/server/v2"
	"github.com/mochi-mqtt/server/v2/hooks/auth"
	"github.com/mochi-mqtt/server/v2/listeners"

	"marq-living/services/internal/mqttx"
	"marq-living/services/internal/registry"
	"marq-living/services/internal/store"
	"marq-living/services/internal/telemetry"
)

type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *fakeClock) Now() time.Time  { c.mu.Lock(); defer c.mu.Unlock(); return c.t }
func (c *fakeClock) Set(t time.Time) { c.mu.Lock(); c.t = t; c.mu.Unlock() }

const (
	relayID = "d2000000-0000-0000-0000-000000000001"
	pirID   = "d2000000-0000-0000-0000-000000000002"
	ctID    = "d2000000-0000-0000-0000-000000000003"
	staffID = "a8000000-0000-0000-0000-000000000008"
)

func TestAutomationLoop(t *testing.T) {
	ctx := context.Background()
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))
	if os.Getenv("APP_DB_URL") == "" {
		t.Skip("run via services/test-integration.sh")
	}
	app, _ := pgxpool.New(ctx, os.Getenv("APP_DB_URL"))
	tsdb, _ := pgxpool.New(ctx, os.Getenv("TSDB_URL"))
	defer app.Close()
	defer tsdb.Close()
	if err := store.Migrate(ctx, tsdb); err != nil {
		t.Fatal(err)
	}
	q := func(sql string, args ...any) {
		t.Helper()
		if _, err := app.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
	}
	scan := func(dst any, sql string, args ...any) {
		t.Helper()
		if err := app.QueryRow(ctx, sql, args...).Scan(dst); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
	}
	q(`insert into auth.users (id, email, invited_at, raw_user_meta_data) values ($1, 'st@marq.test', now(), '{"full_name":"Staff","invited_role":"staff"}')`, staffID)
	q(`insert into auth.users (id, email, raw_user_meta_data) values ('a8000000-0000-0000-0000-000000000009', 't@marq.test', '{"full_name":"T","unit":"808","room_letter":"A","floor":"8"}')`)
	q(`insert into public.devices (id, hardware_id, name, type, location, room_id, config) values
	   ($1, 'relay-it', 'Theatre controls', 'relay', 'Theatre', (select id from public.rooms where slug = 'theatre'), '{"outputs":{"lights":0,"hvac":1}}'),
	   ($2, 'pir-it', 'Theatre PIR', 'pir', 'Theatre', (select id from public.rooms where slug = 'theatre'), '{}'),
	   ($3, 'ct-it', 'Theatre CT', 'ct_node', 'Theatre', (select id from public.rooms where slug = 'theatre'), '{}')`, relayID, pirID, ctID)
	q(`update public.rooms set device_ids = array[$1::uuid, $2::uuid, $3::uuid], state = '{"lights":"off","hvac_mode":"setback"}' where slug = 'theatre'`, relayID, pirID, ctID)
	q(`alter table public.bookings disable trigger bookings_validate`)
	defer q(`alter table public.bookings enable trigger bookings_validate`)

	// Booking 20–80 minutes from (real) now.
	now := time.Now().Truncate(time.Second)
	q(`insert into public.bookings (id, amenity_id, tenant_id, unit, period) values
	   ('b2000000-0000-0000-0000-000000000001', (select amenity_id from public.rooms where slug = 'theatre'),
	    'a8000000-0000-0000-0000-000000000009', '808', tstzrange($1, $2))`, now.Add(20*time.Minute), now.Add(80*time.Minute))

	srv := mochi.New(nil)
	_ = srv.AddHook(new(auth.AllowHook), nil)
	_ = srv.AddListener(listeners.NewTCP(listeners.Config{ID: "t", Address: "127.0.0.1:18841"}))
	go srv.Serve()
	defer srv.Close()

	reg := registry.NewCache()
	if err := reg.Load(ctx, app); err != nil {
		t.Fatal(err)
	}
	clk := &fakeClock{t: now}
	svc := NewService(log, app, tsdb, reg, nil)
	svc.Now = clk.Now
	svc.engine = NewEngine(now)

	acks := make(chan struct{}, 100)
	engineClient, err := mqttx.Connect(mqttx.Options{URL: "tcp://127.0.0.1:18841", ClientID: "auto-it", Log: log,
		Subscriptions: map[string]mqtt.MessageHandler{
			"marq/dev/+/event": func(_ mqtt.Client, m mqtt.Message) { svc.HandleDeviceEvent(m.Topic(), m.Payload()) },
			"marq/dev/+/ack": func(_ mqtt.Client, m mqtt.Message) {
				svc.HandleAck(ctx, m.Payload())
				acks <- struct{}{}
			},
		}})
	if err != nil {
		t.Fatal(err)
	}
	defer engineClient.Disconnect(100)
	svc.Pub = engineClient

	// The relay node: acknowledges every command, records what it received.
	var gotMu sync.Mutex
	var got []telemetry.Command
	var node *mqttx.Client
	node, err = mqttx.Connect(mqttx.Options{URL: "tcp://127.0.0.1:18841", ClientID: "relay-it", Log: log,
		Subscriptions: map[string]mqtt.MessageHandler{
			"marq/dev/relay-it/cmd": func(_ mqtt.Client, m mqtt.Message) {
				var c telemetry.Command
				_ = json.Unmarshal(m.Payload(), &c)
				gotMu.Lock()
				got = append(got, c)
				gotMu.Unlock()
				b, _ := json.Marshal(telemetry.Ack{ID: c.ID, OK: true})
				go node.PublishJSON("marq/dev/relay-it/ack", false, b)
			},
			telemetry.HeartbeatTopic: func(_ mqtt.Client, m mqtt.Message) {
				gotMu.Lock()
				got = append(got, telemetry.Command{ID: -1})
				gotMu.Unlock()
			},
		}})
	if err != nil {
		t.Fatal(err)
	}
	defer node.Disconnect(100)

	waitAcks := func(n int) {
		t.Helper()
		for i := 0; i < n; i++ {
			select {
			case <-acks:
			case <-time.After(5 * time.Second):
				t.Fatalf("waited for %d acks, got %d", n, i)
			}
		}
	}
	tick := func(at time.Time) {
		t.Helper()
		clk.Set(at)
		if err := svc.Tick(ctx); err != nil {
			t.Fatal(err)
		}
		if err := svc.Dispatch(ctx); err != nil {
			t.Fatal(err)
		}
	}
	count := func(where string) int {
		var n int
		scan(&n, `select count(*) from public.control_commands where `+where)
		return n
	}

	// --- Heartbeat ------------------------------------------------------------
	if err := svc.Heartbeat(); err != nil {
		t.Fatal(err)
	}

	// --- Before the booking: nothing; 15 minutes before: lights + comfort ------
	tick(now)
	if n := count(`true`); n != 0 {
		t.Fatalf("commands before preheat window: %d", n)
	}
	tick(now.Add(6 * time.Minute))
	waitAcks(2)
	if n := count(`source = 'rule' and status = 'acked' and reason like 'Get room ready%'`); n != 2 {
		t.Fatalf("preheat commands acked: %d", n)
	}
	gotMu.Lock()
	var relayOn, comfort bool
	for _, c := range got {
		relayOn = relayOn || (c.Relay != nil && c.Relay.Ch == 0 && c.Relay.State == "on")
		comfort = comfort || (c.HVAC != nil && c.HVAC.Mode == "comfort" && c.HVAC.SetpointC != nil && *c.HVAC.SetpointC == 21.5)
	}
	gotMu.Unlock()
	if !relayOn || !comfort {
		t.Fatalf("device didn't receive lights on + comfort 21.5 °C: %+v", got)
	}
	tick(now.Add(7 * time.Minute))
	if n := count(`true`); n != 2 {
		t.Fatalf("re-sent commands: %d", n)
	}
	var lights string
	tick(now.Add(8 * time.Minute))
	scan(&lights, `select state->>'lights' from public.rooms where slug = 'theatre'`)
	if lights != "on" {
		t.Fatalf("room state lights=%s", lights)
	}

	// --- Booking ends with people still there; power down once empty ---------
	motion := func(at time.Time) {
		clk.Set(at)
		b := []byte(fmt.Sprintf(`{"ts":%d,"type":"motion","ch":0}`, at.UnixMilli()))
		if err := node.PublishJSON("marq/dev/pir-it/event", false, b); err != nil {
			t.Fatal(err)
		}
		time.Sleep(150 * time.Millisecond)
	}
	end := now.Add(80 * time.Minute)
	motion(end.Add(-time.Minute))
	tick(end.Add(time.Minute))
	if n := count(`reason like 'Power down%'`); n != 0 {
		t.Fatal("powered down while occupied")
	}
	motion(end.Add(3 * time.Minute))
	tick(end.Add(9 * time.Minute))
	if n := count(`reason like 'Power down%'`); n != 0 {
		t.Fatal("powered down before 10 minutes without motion")
	}
	tick(end.Add(14 * time.Minute))
	waitAcks(2)
	if n := count(`reason like 'Power down after a booking%' and status = 'acked'`); n != 2 {
		t.Fatalf("power-down commands: %d", n)
	}

	// --- Unbooked use → staff alert (once per hour) ---------------------------
	later := end.Add(40 * time.Minute)
	clk.Set(later)
	motion(later)
	tick(later)
	var alerts int
	scan(&alerts, `select count(*) from public.notifications where kind = 'staff_alert' and title = 'Theatre Room in use without a booking'`)
	if alerts < 1 {
		t.Fatal("no unbooked-use alert")
	}
	motion(later.Add(time.Minute))
	tick(later.Add(time.Minute))
	var again int
	scan(&again, `select count(*) from public.notifications where kind = 'staff_alert' and title = 'Theatre Room in use without a booking'`)
	if again != alerts {
		t.Fatal("alert should respect cooldown")
	}

	// --- Manual override (as staff, through the SQL function) beats rules ----
	tx, _ := app.Begin(ctx)
	_, _ = tx.Exec(ctx, `select set_config('request.jwt.claim.sub', $1, true), set_config('role', 'authenticated', true)`, staffID)
	if _, err := tx.Exec(ctx, `select public.set_room_override('theatre', 'force_on')`); err != nil {
		t.Fatal(err)
	}
	_ = tx.Commit(ctx)
	tick(later.Add(2 * time.Minute))
	waitAcks(2)
	if n := count(`source = 'user' and user_id = '` + staffID + `' and status = 'acked'`); n != 2 {
		t.Fatalf("manual override commands attributed to staff: %d", n)
	}
	// A booking that starts during the override must not touch the room.
	q(`insert into public.bookings (id, amenity_id, tenant_id, unit, period) values
	   ('b2000000-0000-0000-0000-000000000002', (select amenity_id from public.rooms where slug = 'theatre'),
	    'a8000000-0000-0000-0000-000000000009', '808', tstzrange($1, $2))`, later.Add(10*time.Minute), later.Add(70*time.Minute))
	before := count(`true`)
	tick(later.Add(5 * time.Minute))
	tick(later.Add(80 * time.Minute))
	tick(later.Add(100 * time.Minute))
	if n := count(`true`); n != before {
		t.Fatalf("automation acted during manual override (%d → %d)", before, n)
	}

	// --- Unacknowledged commands expire --------------------------------------
	q(`insert into public.control_commands (device_id, command, source, status, sent_at) values ($1, '{"relay":{"ch":0,"state":"on"}}', 'system', 'sent', now() - interval '1 minute')`, pirID)
	if err := svc.Dispatch(ctx); err != nil {
		t.Fatal(err)
	}
	if n := count(`status = 'expired'`); n != 1 {
		t.Fatalf("expired: %d", n)
	}

	// --- Energy per finished booking -----------------------------------------
	past := time.Now().Add(-3 * time.Hour).Truncate(time.Minute)
	q(`insert into public.bookings (id, amenity_id, tenant_id, unit, period) values
	   ('b2000000-0000-0000-0000-000000000003', (select amenity_id from public.rooms where slug = 'theatre'),
	    'a8000000-0000-0000-0000-000000000009', '808', tstzrange($1, $2))`, past, past.Add(time.Hour))
	// 2.4 kW for the hour plus 15 min preheat → counter rises 3.0 kWh.
	for m := -15; m <= 60; m++ {
		ts := past.Add(time.Duration(m) * time.Minute)
		kwh := 100 + float64(m+15)*2.4/60
		if _, err := tsdb.Exec(ctx, `insert into readings (ts, device_id, channel, current_a, power_w, energy_kwh) values ($1, $2, 0, 20, 2400, $3)`, ts, ctID, kwh); err != nil {
			t.Fatal(err)
		}
	}
	if err := svc.RecordBookingEnergy(ctx); err != nil {
		t.Fatal(err)
	}
	var e float64
	scan(&e, `select energy_kwh from public.bookings where id = 'b2000000-0000-0000-0000-000000000003'`)
	if e < 2.95 || e > 3.05 {
		t.Fatalf("booking energy %.3f kWh", e)
	}

	gotMu.Lock()
	hb := false
	for _, c := range got {
		hb = hb || c.ID == -1
	}
	gotMu.Unlock()
	if !hb {
		t.Fatal("heartbeat not received")
	}
}

func TestEVLoadManagement(t *testing.T) {
	ctx := context.Background()
	if os.Getenv("APP_DB_URL") == "" {
		t.Skip("run via services/test-integration.sh")
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))
	app, _ := pgxpool.New(ctx, os.Getenv("APP_DB_URL"))
	tsdb, _ := pgxpool.New(ctx, os.Getenv("TSDB_URL"))
	defer app.Close()
	defer tsdb.Close()
	_ = store.Migrate(ctx, tsdb)
	exec := func(db *pgxpool.Pool, sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
	}
	const evDev, lobby, tenant = "d3000000-0000-0000-0000-000000000001", "d3000000-0000-0000-0000-000000000002", "a6000000-0000-0000-0000-000000000006"
	exec(app, `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'ev2@marq.test', '{"full_name":"Ev","unit":"606","room_letter":"A","floor":"6"}')`, tenant)
	exec(app, `insert into public.devices (id, hardware_id, name, type, location) values ($1, 'ev-it', 'EV P9', 'ev_charger', 'Parking'), ($2, 'ct-lobby-ev', 'Lobby', 'ct_node', 'Lobby')`, evDev, lobby)
	exec(app, `insert into public.ev_chargers (id, label, device_id, max_kw) values ('c3000000-0000-0000-0000-000000000001', 'P9', $1, 7.2)`, evDev)
	now := time.Now()
	plan := fmt.Sprintf(`{"slots":[{"start":%q,"end":%q,"kw":7.2}]}`, now.Add(-5*time.Minute).UTC().Format(time.RFC3339), now.Add(time.Hour).UTC().Format(time.RFC3339))
	exec(app, `insert into public.ev_sessions (id, tenant_id, charger_id, requested_kwh, departure_time, status, plan)
		values ('e3000000-0000-0000-0000-000000000001', $1, 'c3000000-0000-0000-0000-000000000001', 5, now() + interval '8 hours', 'scheduled', $2)`, tenant, plan)
	// Building at 130 kW (limit 150): plenty of headroom.
	exec(tsdb, `insert into readings (ts, device_id, channel, current_a, power_w, energy_kwh) values (now(), $1, 0, 1, 130000, 1), (now() - interval '1 minute', $2, 0, 0, 0, 10.0)`, lobby, evDev)

	reg := registry.NewCache()
	_ = reg.Load(ctx, app)
	svc := NewService(log, app, tsdb, reg, nil)
	cmd := func() (string, string) {
		var c, r string
		if err := app.QueryRow(ctx, `select command::text, reason from public.control_commands where device_id = $1 order by id desc limit 1`, evDev).Scan(&c, &r); err != nil {
			t.Fatal(err)
		}
		return c, r
	}
	if err := svc.ApplyEV(ctx); err != nil {
		t.Fatal(err)
	}
	if c, _ := cmd(); c != `{"ev": {"limit_kw": 7.2}}` {
		t.Fatalf("plan not followed: %s", c)
	}
	var status string
	_ = app.QueryRow(ctx, `select status::text from public.ev_sessions where id = 'e3000000-0000-0000-0000-000000000001'`).Scan(&status)
	if status != "charging" {
		t.Fatalf("status %s", status)
	}

	// Building load jumps to 146 kW: only 4 kW of headroom left.
	exec(tsdb, `insert into readings (ts, device_id, channel, current_a, power_w, energy_kwh) values (now() + interval '1 second', $1, 0, 1, 146000, 1)`, lobby)
	if err := svc.ApplyEV(ctx); err != nil {
		t.Fatal(err)
	}
	c, reason := cmd()
	if c != `{"ev": {"limit_kw": 4}}` || len(reason) < 10 || reason[:10] != "Peak guard" {
		t.Fatalf("peak guard: %s (%s)", c, reason)
	}

	// The car's meter shows 5 kWh delivered → session completes, charger to 0.
	exec(tsdb, `insert into readings (ts, device_id, channel, current_a, power_w, energy_kwh) values (now() + interval '2 seconds', $1, 0, 30, 7200, 15.0)`, evDev)
	exec(app, `update public.ev_sessions set started_at = now() - interval '2 minutes' where id = 'e3000000-0000-0000-0000-000000000001'`)
	if err := svc.ApplyEV(ctx); err != nil {
		t.Fatal(err)
	}
	_ = app.QueryRow(ctx, `select status::text from public.ev_sessions where id = 'e3000000-0000-0000-0000-000000000001'`).Scan(&status)
	if c, _ := cmd(); status != "completed" || c != `{"ev": {"limit_kw": 0}}` {
		t.Fatalf("completion: %s %s", status, c)
	}
	var n int
	_ = app.QueryRow(ctx, `select count(*) from public.notifications where user_id = $1 and title = 'Charging complete'`, tenant).Scan(&n)
	if n != 1 {
		t.Fatal("tenant not told charging is complete")
	}
}
