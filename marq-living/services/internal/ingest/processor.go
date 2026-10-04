// Package ingest turns MQTT device messages into stored readings, device
// presence, laundry availability and device events.
package ingest

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"marq-living/services/internal/anomaly"
	"marq-living/services/internal/appdb"
	"marq-living/services/internal/laundry"
	"marq-living/services/internal/notify"
	"marq-living/services/internal/registry"
	"marq-living/services/internal/store"
	"marq-living/services/internal/telemetry"
)

// Publisher sends derived events to the automation engine.
type Publisher interface {
	PublishJSON(topic string, retained bool, payload []byte) error
}

type Processor struct {
	Log      *slog.Logger
	Registry *registry.Cache
	Writer   *store.Writer
	App      *appdb.DB
	TSDB     *pgxpool.Pool
	Pub      Publisher
	Notifier *notify.Poker
	Loc      *time.Location
	Now      func() time.Time

	Anomaly  *anomaly.Detector
	Presence *anomaly.Presence

	mu       sync.Mutex
	machines map[chanKey]*machine
	energy   map[chanKey]*energyState

	Stats Stats
}

type Stats struct {
	Messages, Rejected, UnknownDevice, Readings, Events atomic.Int64
}

type chanKey struct {
	dev string
	ch  int
}

type machine struct {
	id    string
	label string
	m     *laundry.Machine
}

type energyState struct {
	ts     time.Time
	powerW float64
	kwh    float64
}

func New(log *slog.Logger, reg *registry.Cache, w *store.Writer, app *appdb.DB, tsdb *pgxpool.Pool, pub Publisher, n *notify.Poker) *Processor {
	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		loc = time.UTC
	}
	return &Processor{
		Log: log, Registry: reg, Writer: w, App: app, TSDB: tsdb, Pub: pub, Notifier: n, Loc: loc, Now: time.Now,
		Anomaly: anomaly.NewDetector(loc), Presence: anomaly.NewPresence(),
		machines: map[chanKey]*machine{}, energy: map[chanKey]*energyState{},
	}
}

// LoadMachines (re)builds laundry state machines, keeping in-progress state
// for machines that are already tracked.
func (p *Processor) LoadMachines(ctx context.Context) error {
	ms, err := p.App.Machines(ctx)
	if err != nil {
		return err
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	next := map[chanKey]*machine{}
	for _, m := range ms {
		k := chanKey{m.DeviceID, m.Channel}
		sig := laundry.ParseSignature(m.Kind, m.Signature)
		if cur, ok := p.machines[k]; ok && cur.id == m.ID {
			cur.m.Sig, cur.label = sig, m.Label
			if m.State == "idle" && cur.m.State == laundry.Fault {
				cur.m.Reset() // staff resolved the fault
			}
			next[k] = cur
			continue
		}
		next[k] = &machine{id: m.ID, label: m.Label, m: laundry.NewMachine(sig, laundry.State(m.State))}
	}
	p.machines = next
	return nil
}

func (p *Processor) Handle(ctx context.Context, topic string, payload []byte) {
	p.Stats.Messages.Add(1)
	tp, err := telemetry.ParseTopic(topic)
	if err != nil {
		p.Stats.Rejected.Add(1)
		return
	}
	dev, ok := p.Registry.ByHW(tp.HW)
	if !ok {
		p.Stats.UnknownDevice.Add(1)
		p.Log.Debug("message from unregistered device", "hw", tp.HW)
		return
	}
	switch tp.Kind {
	case "telemetry":
		p.telemetry(ctx, dev, payload)
	case "status":
		p.status(ctx, dev, payload)
	case "event":
		p.event(ctx, dev, payload)
	}
}

func (p *Processor) telemetry(ctx context.Context, dev registry.Device, b []byte) {
	now := p.Now()
	t, warns, err := telemetry.ParseTelemetry(b, now)
	if err != nil {
		p.Stats.Rejected.Add(1)
		p.Log.Warn("rejected telemetry", "hw", dev.HW, "err", err)
		return
	}
	if len(warns) > 0 {
		p.Log.Warn("dropped bad channels", "hw", dev.HW, "warnings", warns)
	}
	at := t.Time()
	rows := make([]store.Reading, 0, len(t.Channels))
	for _, c := range t.Channels {
		i, w := dev.Calibrate(c.Ch, c.CurrentA, c.PowerW)
		kwh := p.energyKWh(ctx, dev.ID, c.Ch, at, w, c.EnergyWh)
		rows = append(rows, store.Reading{TS: at, DeviceID: dev.ID, Channel: int16(c.Ch), CurrentA: float32(i), PowerW: float32(w), EnergyKWh: kwh})

		// Only live data drives state; replayed history is stored but not acted on.
		if now.Sub(at) < 2*time.Minute {
			p.laundry(ctx, dev, c.Ch, at, w)
			for _, f := range p.Anomaly.Observe(dev, c.Ch, at, w) {
				p.raise(ctx, dev, f.Type, at, map[string]any{"channel": f.Channel, "power_w": round(f.PowerW), "message": f.Message})
			}
		}
	}
	p.Writer.Add(rows...)
	p.Stats.Readings.Add(int64(len(rows)))
	p.seen(ctx, dev, at, appdb.Presence{LastSeen: at})
}

// energyKWh returns the channel's lifetime energy: the device's own counter
// when it sends one, else trapezoidal integration of power, continued from
// the last stored value after a restart.
func (p *Processor) energyKWh(ctx context.Context, devID string, ch int, at time.Time, powerW float64, energyWh *float64) float64 {
	k := chanKey{devID, ch}
	p.mu.Lock()
	st := p.energy[k]
	p.mu.Unlock()
	if energyWh != nil {
		kwh := *energyWh / 1000
		p.mu.Lock()
		p.energy[k] = &energyState{ts: at, powerW: powerW, kwh: kwh}
		p.mu.Unlock()
		return kwh
	}
	if st == nil {
		st = &energyState{ts: at, powerW: powerW}
		if p.TSDB != nil {
			_ = p.TSDB.QueryRow(ctx, `select coalesce(max(energy_kwh), 0) from readings where device_id = $1 and channel = $2 and ts > now() - interval '30 days'`, devID, ch).Scan(&st.kwh)
		}
	} else if at.After(st.ts) {
		dt := at.Sub(st.ts).Hours()
		if dt < 1 { // don't bridge long gaps with a guess
			st.kwh += (st.powerW + powerW) / 2 / 1000 * dt
		}
		st.ts, st.powerW = at, powerW
	}
	p.mu.Lock()
	p.energy[k] = st
	p.mu.Unlock()
	return st.kwh
}

func (p *Processor) laundry(ctx context.Context, dev registry.Device, ch int, at time.Time, w float64) {
	p.mu.Lock()
	m := p.machines[chanKey{dev.ID, ch}]
	var change *laundry.Change
	if m != nil {
		change = m.m.Observe(at, w)
	}
	p.mu.Unlock()
	if change == nil {
		return
	}
	payload := map[string]any{"channel": ch, "machine_id": m.id, "machine": m.label, "from": string(change.From), "to": string(change.To), "power_w": round(w), "reason": change.Reason}
	p.publish(telemetry.SysEvent{Kind: "machine_state", DeviceID: dev.ID, HW: dev.HW, Channel: ch, From: string(change.From), To: string(change.To), PowerW: w, TS: at})
	if change.To == laundry.Fault {
		payload["message"] = m.label + ": " + change.Reason
		p.raise(ctx, dev, "fault", at, payload)
		return
	}
	if err := p.App.Event(ctx, dev.ID, "state_change", at, payload); err != nil {
		p.Log.Error("record state change", "err", err)
	}
	n, err := p.App.SetMachineState(ctx, m.id, string(change.To), at, change.EstDoneAt)
	if err != nil {
		p.Log.Error("update laundry machine", "machine", m.label, "err", err)
	}
	if n > 0 {
		p.Notifier.Kick()
	}
}

func (p *Processor) status(ctx context.Context, dev registry.Device, b []byte) {
	s, err := telemetry.ParseStatus(b)
	if err != nil {
		p.Stats.Rejected.Add(1)
		return
	}
	now := p.Now()
	if s.State == "offline" {
		if p.Presence.MarkOffline(dev.ID) {
			p.raise(ctx, dev, "offline", now, map[string]any{"message": dev.Name + " disconnected (last will)"})
		}
		return
	}
	var fw *string
	if s.FW != "" {
		fw = &s.FW
	}
	p.seen(ctx, dev, now, appdb.Presence{LastSeen: now, FW: fw, RSSI: s.RSSI, BatteryPct: s.BatteryPct})
}

func (p *Processor) event(ctx context.Context, dev registry.Device, b []byte) {
	e, err := telemetry.ParseEvent(b, p.Now())
	if err != nil {
		p.Stats.Rejected.Add(1)
		return
	}
	at := e.Time()
	switch e.Type {
	case "motion", "button":
		p.Writer.AddMetric(store.Metric{TS: at, DeviceID: dev.ID, Name: e.Type, Channel: int16(e.Ch), Value: 1})
	case "soc":
		p.Writer.AddMetric(store.Metric{TS: at, DeviceID: dev.ID, Name: "soc_pct", Channel: int16(e.Ch), Value: *e.Value})
	case "temperature":
		p.Writer.AddMetric(store.Metric{TS: at, DeviceID: dev.ID, Name: "temperature_c", Channel: int16(e.Ch), Value: *e.Value})
	case "relay":
		typ := "state_change"
		if e.Source == "failsafe" || e.Source == "manual" {
			typ = "override"
		}
		_ = p.App.Event(ctx, dev.ID, typ, at, map[string]any{"channel": e.Ch, "relay": e.State, "source": e.Source})
		p.Stats.Events.Add(1)
	}
	p.seen(ctx, dev, at, appdb.Presence{LastSeen: at})
}

func (p *Processor) seen(ctx context.Context, dev registry.Device, at time.Time, pr appdb.Presence) {
	if p.Presence.Seen(dev.ID, at) {
		_ = p.App.Event(ctx, dev.ID, "online", at, map[string]any{"message": dev.Name + " reconnected"})
		p.publish(telemetry.SysEvent{Kind: "online", DeviceID: dev.ID, HW: dev.HW, TS: at})
	}
	p.App.Touch(dev.ID, pr)
}

func (p *Processor) raise(ctx context.Context, dev registry.Device, typ string, at time.Time, payload map[string]any) {
	p.Stats.Events.Add(1)
	if err := p.App.Event(ctx, dev.ID, typ, at, payload); err != nil {
		p.Log.Error("record device event", "type", typ, "err", err)
		return
	}
	msg, _ := payload["message"].(string)
	ch, _ := payload["channel"].(int)
	p.publish(telemetry.SysEvent{Kind: typ, DeviceID: dev.ID, HW: dev.HW, Channel: ch, Message: msg, TS: at})
	p.Notifier.Kick()
	p.Log.Info("device event", "type", typ, "hw", dev.HW, "message", msg)
}

func (p *Processor) publish(e telemetry.SysEvent) {
	if p.Pub == nil {
		return
	}
	b, _ := json.Marshal(e)
	if err := p.Pub.PublishJSON(telemetry.SysEventsTopic, false, b); err != nil {
		p.Log.Warn("publish sys event", "err", err)
	}
}

// Sweep marks silent devices offline. Run every ~15 s.
func (p *Processor) Sweep(ctx context.Context) {
	for _, d := range p.Presence.Sweep(p.Now(), p.Registry.All()) {
		p.raise(ctx, d, "offline", p.Now(), map[string]any{"message": d.Name + " stopped reporting"})
	}
}

func round(f float64) float64 { return float64(int64(f*10+0.5)) / 10 }
