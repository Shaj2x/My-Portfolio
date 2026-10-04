package automation

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"marq-living/services/internal/notify"
	"marq-living/services/internal/registry"
	"marq-living/services/internal/tariff"
	"marq-living/services/internal/telemetry"
)

// Publisher sends MQTT messages.
type Publisher interface {
	PublishJSON(topic string, retained bool, payload []byte) error
}

// Service is the running automation engine: it loads rooms, bookings and
// rules from the app DB, keeps occupancy from PIR events, evaluates rules,
// and logs every physical action as a control_commands row that the
// dispatcher publishes and the device acknowledges.
type Service struct {
	Log      *slog.Logger
	App      *pgxpool.Pool
	TSDB     *pgxpool.Pool
	Pub      Publisher
	Registry *registry.Cache
	Notifier *notify.Poker
	Plan     string // tariff plan for price_period conditions
	Now      func() time.Time

	engine *Engine
	mu     sync.Mutex
	rooms  map[string]*RoomState
	roomBy map[string]string // room id → slug
	motion map[string]bool
	events []DeviceEvent
	saved  map[string]string // slug → last persisted state JSON
}

func NewService(log *slog.Logger, app, tsdb *pgxpool.Pool, reg *registry.Cache, n *notify.Poker) *Service {
	now := time.Now()
	return &Service{Log: log, App: app, TSDB: tsdb, Registry: reg, Notifier: n, Plan: "ulo", Now: time.Now,
		engine: NewEngine(now), rooms: map[string]*RoomState{}, roomBy: map[string]string{}, motion: map[string]bool{}, saved: map[string]string{}}
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

// HandleDeviceEvent processes marq/dev/{hw}/event (motion, relay state).
func (s *Service) HandleDeviceEvent(topic string, payload []byte) {
	tp, err := telemetry.ParseTopic(topic)
	if err != nil {
		return
	}
	dev, ok := s.Registry.ByHW(tp.HW)
	if !ok {
		return
	}
	e, err := telemetry.ParseEvent(payload, s.Now())
	if err != nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	slug := s.roomBy[dev.RoomID]
	room := s.rooms[slug]
	if room == nil {
		return
	}
	switch e.Type {
	case "motion":
		if e.Time().After(room.LastMotion) {
			room.LastMotion = e.Time()
		}
		s.motion[slug] = true
	case "relay":
		out := outputName(dev, e.Ch)
		if out == "lights" {
			room.Lights = e.State
		} else if out == "hvac" && e.Source != "command" {
			// Fail-safe/manual switch: HVAC back to normal operation.
			if e.State == "on" {
				room.HVAC = "comfort"
			} else {
				room.HVAC = "off"
			}
		}
	}
}

// HandleSysEvent processes marq/sys/events from ingest (faults, anomalies).
func (s *Service) HandleSysEvent(payload []byte) {
	var e telemetry.SysEvent
	if json.Unmarshal(payload, &e) != nil || (e.Kind != "fault" && e.Kind != "anomaly") {
		return
	}
	dev, _ := s.Registry.ByID(e.DeviceID)
	s.mu.Lock()
	s.events = append(s.events, DeviceEvent{Kind: e.Kind, Room: s.roomBy[dev.RoomID], Message: e.Message})
	s.mu.Unlock()
}

// HandleAck processes marq/dev/{hw}/ack: marks the command and applies its
// effect to the known room state.
func (s *Service) HandleAck(ctx context.Context, payload []byte) {
	var a telemetry.Ack
	if json.Unmarshal(payload, &a) != nil || a.ID == 0 {
		return
	}
	status := "acked"
	if !a.OK {
		status = "failed"
	}
	var cmd []byte
	var roomID *string
	err := s.App.QueryRow(ctx, `update public.control_commands set status = $2::public.command_status, acked_at = now(), error = nullif($3, '')
		where id = $1 and status in ('sent', 'queued') returning command, room_id::text`, a.ID, status, a.Error).Scan(&cmd, &roomID)
	if err != nil || !a.OK || roomID == nil {
		return
	}
	var c telemetry.Command
	_ = json.Unmarshal(cmd, &c)
	s.mu.Lock()
	defer s.mu.Unlock()
	room := s.rooms[s.roomBy[*roomID]]
	if room == nil {
		return
	}
	if c.Relay != nil {
		room.Lights = c.Relay.State
	}
	if c.HVAC != nil {
		room.HVAC = c.HVAC.Mode
	}
}

func outputName(d registry.Device, ch int) string {
	for name, c := range d.Config.Outputs {
		if c == ch {
			return name
		}
	}
	if ch == 0 {
		return "lights"
	}
	return "hvac"
}

// ---------------------------------------------------------------------------
// Evaluation tick
// ---------------------------------------------------------------------------

type roomRow struct {
	id, slug, name, override string
	overrideUntil            *time.Time
	setpoints, state         []byte
}

func (s *Service) loadRooms(ctx context.Context) ([]roomRow, error) {
	rows, err := s.App.Query(ctx, `select id::text, slug, name, override_mode::text, override_until, hvac_setpoints, state from public.rooms`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []roomRow
	for rows.Next() {
		var r roomRow
		if err := rows.Scan(&r.id, &r.slug, &r.name, &r.override, &r.overrideUntil, &r.setpoints, &r.state); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Service) loadBookings(ctx context.Context, now time.Time) ([]Booking, error) {
	rows, err := s.App.Query(ctx, `select b.id::text, r.slug, lower(b.period), upper(b.period)
		from public.bookings b join public.rooms r on r.amenity_id = b.amenity_id
		where b.status in ('confirmed', 'completed') and b.period && tstzrange($1, $2)`, now.Add(-7*time.Hour), now.Add(12*time.Hour))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Booking
	for rows.Next() {
		var b Booking
		if err := rows.Scan(&b.ID, &b.Room, &b.Start, &b.End); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (s *Service) loadRules(ctx context.Context) ([]Rule, error) {
	rows, err := s.App.Query(ctx, `select id::text, name, priority, trigger, conditions, actions from public.automation_rules where enabled order by priority, created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Rule
	for rows.Next() {
		var id, name string
		var prio int
		var tr, co, ac []byte
		if err := rows.Scan(&id, &name, &prio, &tr, &co, &ac); err != nil {
			return nil, err
		}
		r, err := ParseRule(id, name, prio, tr, co, ac)
		if err != nil {
			s.Log.Warn("skipping invalid rule", "rule", name, "err", err)
			continue
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

type persisted struct {
	Lights     string     `json:"lights,omitempty"`
	HVAC       string     `json:"hvac_mode,omitempty"`
	Occupied   bool       `json:"occupied"`
	LastMotion *time.Time `json:"last_motion,omitempty"`
}

// Tick runs one evaluation: refresh inputs, evaluate rules, execute actions,
// persist room state. Run every ~10 s.
func (s *Service) Tick(ctx context.Context) error {
	now := s.Now()
	rr, err := s.loadRooms(ctx)
	if err != nil {
		return err
	}
	bookings, err := s.loadBookings(ctx, now)
	if err != nil {
		return err
	}
	rules, err := s.loadRules(ctx)
	if err != nil {
		return err
	}

	s.mu.Lock()
	byID := map[string]string{}
	setpoints := map[string]map[string]float64{}
	for _, r := range rr {
		byID[r.id] = r.slug
		room := s.rooms[r.slug]
		if room == nil {
			room = &RoomState{Slug: r.slug}
			var p persisted
			if json.Unmarshal(r.state, &p) == nil {
				room.Lights, room.HVAC = p.Lights, p.HVAC
				if p.LastMotion != nil {
					room.LastMotion = *p.LastMotion
				}
			}
			s.rooms[r.slug] = room
		}
		room.Name = r.name
		room.Override = r.override
		if r.overrideUntil != nil && now.After(*r.overrideUntil) {
			room.Override = "auto"
			_, _ = s.App.Exec(ctx, `update public.rooms set override_mode = 'auto', override_until = null where id = $1`, r.id)
		}
		sp := map[string]float64{}
		_ = json.Unmarshal(r.setpoints, &sp)
		setpoints[r.slug] = sp
		room.PreheatMin = int(sp["preheat_minutes"])
	}
	s.roomBy = byID
	snap := Snapshot{Now: now.In(tariff.Loc), Rooms: map[string]*RoomState{}, Bookings: bookings, Motion: s.motion,
		DeviceEvents: s.events, PricePeriod: tariff.Period(s.Plan, now)}
	for k, v := range s.rooms {
		cp := *v
		snap.Rooms[k] = &cp
	}
	s.motion, s.events = map[string]bool{}, nil
	actions, skipped := s.engine.Evaluate(rules, snap)
	s.mu.Unlock()

	for _, p := range skipped {
		s.Log.Info("automation skipped: manual override", "room", p.Room, "rule", p.Rule.Name, "action", p.Action.Type)
	}
	for _, p := range actions {
		if err := s.execute(ctx, p, setpoints[p.Room]); err != nil {
			s.Log.Error("automation action failed", "rule", p.Rule.Name, "room", p.Room, "err", err)
		}
	}
	s.persist(ctx, now)
	return nil
}

func (s *Service) execute(ctx context.Context, p Planned, sp map[string]float64) error {
	switch p.Action.Type {
	case "notify_staff":
		_, err := s.App.Exec(ctx, `select public.notify_staff($1, $2, '/staff/rooms', jsonb_build_object('rule_id', $3::text, 'room', $4::text), true)`,
			p.Action.Title, p.Action.Body, p.Rule.ID, p.Room)
		s.Notifier.Kick()
		return err
	case "set_lights", "set_hvac":
		dev, ch, err := s.controller(ctx, p.Room, p.Action.Type)
		if err != nil {
			return err
		}
		var cmd telemetry.Command
		if p.Action.Type == "set_lights" {
			cmd.Relay = &telemetry.RelayCmd{Ch: ch, State: p.Action.State}
		} else {
			key := map[string]string{"comfort": "comfort_c", "setback": "setback_c"}[p.Action.Mode]
			var set *float64
			if v, ok := sp[key]; ok {
				set = &v
			}
			cmd.HVAC = &telemetry.HVACCmd{Mode: p.Action.Mode, SetpointC: set}
		}
		body, _ := json.Marshal(cmd)
		_, err = s.App.Exec(ctx, `insert into public.control_commands (device_id, room_id, command, source, rule_id, reason)
			values ($1, (select id from public.rooms where slug = $2), $3, 'rule', $4, $5)`, dev, p.Room, body, p.Rule.ID, p.Reason)
		if err == nil {
			// Optimistic: the ack confirms; until then don't re-send.
			s.mu.Lock()
			if r := s.rooms[p.Room]; r != nil {
				if cmd.Relay != nil {
					r.Lights = cmd.Relay.State
				} else {
					r.HVAC = cmd.HVAC.Mode
				}
			}
			s.mu.Unlock()
		}
		return err
	}
	return fmt.Errorf("unknown action %s", p.Action.Type)
}

// controller finds the device and channel driving a room's lights or HVAC:
// a thermostat for HVAC if the room has one, else the relay node's mapped output.
func (s *Service) controller(ctx context.Context, room, action string) (string, int, error) {
	rows, err := s.App.Query(ctx, `select d.id::text, d.type::text from public.devices d
		join public.rooms r on d.id = any(r.device_ids) where r.slug = $1 and d.type in ('relay', 'thermostat') and d.status <> 'retired'`, room)
	if err != nil {
		return "", 0, err
	}
	defer rows.Close()
	var relay, thermo string
	for rows.Next() {
		var id, typ string
		if err := rows.Scan(&id, &typ); err != nil {
			return "", 0, err
		}
		if typ == "thermostat" {
			thermo = id
		} else if relay == "" {
			relay = id
		}
	}
	if action == "set_hvac" && thermo != "" {
		return thermo, 0, nil
	}
	if relay == "" {
		return "", 0, fmt.Errorf("room %s has no relay or thermostat", room)
	}
	dev, _ := s.Registry.ByID(relay)
	out := "lights"
	if action == "set_hvac" {
		out = "hvac"
	}
	ch, ok := dev.Config.Outputs[out]
	if !ok {
		ch = map[string]int{"lights": 0, "hvac": 1}[out]
	}
	return relay, ch, nil
}

func (s *Service) persist(ctx context.Context, now time.Time) {
	s.mu.Lock()
	type upd struct{ slug, body string }
	var ups []upd
	for slug, r := range s.rooms {
		p := persisted{Lights: r.Lights, HVAC: r.HVAC, Occupied: !r.LastMotion.IsZero() && now.Sub(r.LastMotion) < 10*time.Minute}
		if !r.LastMotion.IsZero() {
			lm := r.LastMotion
			p.LastMotion = &lm
		}
		b, _ := json.Marshal(p)
		if s.saved[slug] != string(b) {
			s.saved[slug] = string(b)
			ups = append(ups, upd{slug, string(b)})
		}
	}
	s.mu.Unlock()
	for _, u := range ups {
		_, _ = s.App.Exec(ctx, `update public.rooms set state = $2::jsonb || jsonb_build_object('updated_at', now()) where slug = $1`, u.slug, u.body)
	}
}

// ---------------------------------------------------------------------------
// Command dispatch
// ---------------------------------------------------------------------------

// Dispatch publishes queued commands (from rules, schedules, staff) to their
// devices and expires unacknowledged ones. Run every ~2 s.
func (s *Service) Dispatch(ctx context.Context) error {
	if _, err := s.App.Exec(ctx, `update public.control_commands set status = 'expired', error = 'no acknowledgement within 30 s'
		where status = 'sent' and sent_at < now() - interval '30 seconds'`); err != nil {
		return err
	}
	rows, err := s.App.Query(ctx, `select c.id, d.hardware_id, c.command from public.control_commands c
		join public.devices d on d.id = c.device_id where c.status = 'queued' order by c.id limit 100`)
	if err != nil {
		return err
	}
	type q struct {
		id  int64
		hw  string
		cmd []byte
	}
	var queue []q
	for rows.Next() {
		var x q
		if err := rows.Scan(&x.id, &x.hw, &x.cmd); err != nil {
			rows.Close()
			return err
		}
		queue = append(queue, x)
	}
	rows.Close()
	for _, x := range queue {
		var c map[string]json.RawMessage
		if json.Unmarshal(x.cmd, &c) != nil {
			_, _ = s.App.Exec(ctx, `update public.control_commands set status = 'failed', error = 'invalid command json' where id = $1`, x.id)
			continue
		}
		c["id"] = json.RawMessage(strconv.FormatInt(x.id, 10))
		body, _ := json.Marshal(c)
		if err := s.Pub.PublishJSON(telemetry.DeviceTopic(x.hw, "cmd"), false, body); err != nil {
			s.Log.Warn("publish command", "id", x.id, "err", err)
			continue
		}
		_, _ = s.App.Exec(ctx, `update public.control_commands set status = 'sent', sent_at = now() where id = $1 and status = 'queued'`, x.id)
	}
	return nil
}

// Heartbeat tells room nodes the engine is alive (they fail safe without it).
func (s *Service) Heartbeat() error {
	b, _ := json.Marshal(map[string]any{"ts": s.Now().UnixMilli(), "from": "automation"})
	return s.Pub.PublishJSON(telemetry.HeartbeatTopic, true, b)
}

// RecordBookingEnergy stores kWh used by each finished booking's room
// (pre-conditioning included), from the room's metered channels.
func (s *Service) RecordBookingEnergy(ctx context.Context) error {
	rows, err := s.App.Query(ctx, `select b.id::text, lower(b.period) - make_interval(mins => coalesce((r.hvac_setpoints->>'preheat_minutes')::int, 15)),
		upper(b.period), coalesce(array_agg(d.id::text) filter (where d.type = 'ct_node'), '{}')
		from public.bookings b join public.rooms r on r.amenity_id = b.amenity_id
		left join public.devices d on d.id = any(r.device_ids)
		where b.status in ('confirmed', 'completed') and b.energy_kwh is null
		  and upper(b.period) < now() - interval '5 minutes' and upper(b.period) > now() - interval '7 days'
		group by b.id, r.hvac_setpoints`)
	if err != nil {
		return err
	}
	type job struct {
		id         string
		start, end time.Time
		devs       []string
	}
	var jobs []job
	for rows.Next() {
		var j job
		if err := rows.Scan(&j.id, &j.start, &j.end, &j.devs); err != nil {
			rows.Close()
			return err
		}
		jobs = append(jobs, j)
	}
	rows.Close()
	for _, j := range jobs {
		if len(j.devs) == 0 {
			continue
		}
		var kwh float64
		err := s.TSDB.QueryRow(ctx, `select coalesce(sum(d), 0) from (
			select max(energy_kwh) - min(energy_kwh) as d from readings
			where device_id = any($1::uuid[]) and ts >= $2 and ts <= $3 group by device_id, channel) x`, j.devs, j.start, j.end).Scan(&kwh)
		if err != nil {
			return err
		}
		if _, err := s.App.Exec(ctx, `update public.bookings set energy_kwh = $2 where id = $1`, j.id, kwh); err != nil {
			return err
		}
	}
	return nil
}
