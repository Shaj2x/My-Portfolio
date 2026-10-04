// Package telemetry defines the MQTT payloads (docs/mqtt-protocol.md) and
// their validation. Shared by the ingest and automation services.
package telemetry

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

const (
	MaxChannels   = 16
	MaxCurrentA   = 200   // SCT-013-000 is rated 100 A; anything above 200 A is a bad reading
	MaxPowerW     = 50000 // a single circuit can't plausibly exceed this
	MaxReplayAge  = 24 * time.Hour
	MaxClockAhead = 5 * time.Minute
	// Small negative power from CT phase error near zero load is clamped to 0.
	NoiseFloorW = -50
)

var hwRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,62}$`)

// Topic is a parsed device topic: marq/dev/{hw}/{kind}.
type Topic struct {
	HW   string
	Kind string // telemetry | status | event | cmd | ack
}

func ParseTopic(topic string) (Topic, error) {
	parts := strings.Split(topic, "/")
	if len(parts) != 4 || parts[0] != "marq" || parts[1] != "dev" {
		return Topic{}, fmt.Errorf("not a device topic: %q", topic)
	}
	if !hwRe.MatchString(parts[2]) {
		return Topic{}, fmt.Errorf("bad hardware id %q", parts[2])
	}
	switch parts[3] {
	case "telemetry", "status", "event", "cmd", "ack":
	default:
		return Topic{}, fmt.Errorf("unknown kind %q", parts[3])
	}
	return Topic{HW: parts[2], Kind: parts[3]}, nil
}

func DeviceTopic(hw, kind string) string { return "marq/dev/" + hw + "/" + kind }

type Channel struct {
	Ch       int      `json:"ch"`
	CurrentA *float64 `json:"current_a"`
	PowerW   *float64 `json:"power_w"`
	EnergyWh *float64 `json:"energy_wh"`
}

type Telemetry struct {
	TS       int64     `json:"ts"`
	Seq      int64     `json:"seq"`
	Channels []Channel `json:"channels"`
}

func (t Telemetry) Time() time.Time { return time.UnixMilli(t.TS).UTC() }

// ParseTelemetry decodes and validates a telemetry message. Out-of-range
// channel values are rejected individually (the rest of the message is kept)
// and reported in the returned warnings.
func ParseTelemetry(b []byte, now time.Time) (Telemetry, []string, error) {
	var t Telemetry
	dec := json.NewDecoder(strings.NewReader(string(b)))
	if err := dec.Decode(&t); err != nil {
		return t, nil, fmt.Errorf("decode: %w", err)
	}
	if t.TS <= 0 {
		return t, nil, errors.New("missing ts")
	}
	ts := t.Time()
	if ts.Before(now.Add(-MaxReplayAge)) {
		return t, nil, fmt.Errorf("ts %s older than %s", ts.Format(time.RFC3339), MaxReplayAge)
	}
	if ts.After(now.Add(MaxClockAhead)) {
		return t, nil, fmt.Errorf("ts %s is in the future (device clock not synced?)", ts.Format(time.RFC3339))
	}
	if len(t.Channels) == 0 || len(t.Channels) > MaxChannels {
		return t, nil, fmt.Errorf("need 1–%d channels, got %d", MaxChannels, len(t.Channels))
	}
	var warns []string
	seen := map[int]bool{}
	kept := t.Channels[:0]
	for _, c := range t.Channels {
		switch {
		case c.Ch < 0 || c.Ch >= MaxChannels:
			warns = append(warns, fmt.Sprintf("channel %d out of range", c.Ch))
		case seen[c.Ch]:
			warns = append(warns, fmt.Sprintf("duplicate channel %d", c.Ch))
		case c.CurrentA == nil && c.PowerW == nil:
			warns = append(warns, fmt.Sprintf("channel %d has no current or power", c.Ch))
		case c.CurrentA != nil && (bad(*c.CurrentA) || *c.CurrentA < 0 || *c.CurrentA > MaxCurrentA):
			warns = append(warns, fmt.Sprintf("channel %d current %.2f A out of range", c.Ch, *c.CurrentA))
		case c.PowerW != nil && (bad(*c.PowerW) || *c.PowerW < NoiseFloorW || *c.PowerW > MaxPowerW):
			warns = append(warns, fmt.Sprintf("channel %d power %.1f W out of range", c.Ch, *c.PowerW))
		case c.EnergyWh != nil && (bad(*c.EnergyWh) || *c.EnergyWh < 0):
			warns = append(warns, fmt.Sprintf("channel %d energy invalid", c.Ch))
		default:
			if c.PowerW != nil && *c.PowerW < 0 {
				z := 0.0
				c.PowerW = &z
			}
			seen[c.Ch] = true
			kept = append(kept, c)
		}
	}
	t.Channels = kept
	if len(kept) == 0 {
		return t, warns, errors.New("no valid channels")
	}
	return t, warns, nil
}

func bad(f float64) bool { return math.IsNaN(f) || math.IsInf(f, 0) }

type Status struct {
	State      string `json:"state"`
	FW         string `json:"fw"`
	RSSI       *int   `json:"rssi"`
	BatteryPct *int   `json:"battery_pct"`
	UptimeS    *int64 `json:"uptime_s"`
	Buffered   *int   `json:"buffered"`
	IP         string `json:"ip"`
}

func ParseStatus(b []byte) (Status, error) {
	var s Status
	if err := json.Unmarshal(b, &s); err != nil {
		return s, err
	}
	if s.State != "online" && s.State != "offline" {
		return s, fmt.Errorf("bad state %q", s.State)
	}
	if s.RSSI != nil && (*s.RSSI < -127 || *s.RSSI > 0) {
		s.RSSI = nil
	}
	if s.BatteryPct != nil && (*s.BatteryPct < 0 || *s.BatteryPct > 100) {
		s.BatteryPct = nil
	}
	if len(s.FW) > 32 {
		s.FW = s.FW[:32]
	}
	return s, nil
}

type Event struct {
	TS     int64    `json:"ts"`
	Type   string   `json:"type"` // motion | relay | soc | temperature | button
	Ch     int      `json:"ch"`
	Value  *float64 `json:"value"`
	State  string   `json:"state"`
	Source string   `json:"source"`
}

func (e Event) Time() time.Time { return time.UnixMilli(e.TS).UTC() }

func ParseEvent(b []byte, now time.Time) (Event, error) {
	var e Event
	if err := json.Unmarshal(b, &e); err != nil {
		return e, err
	}
	if e.TS == 0 {
		e.TS = now.UnixMilli()
	}
	if e.Time().After(now.Add(MaxClockAhead)) || e.Time().Before(now.Add(-MaxReplayAge)) {
		return e, errors.New("event ts out of range")
	}
	switch e.Type {
	case "motion", "button":
	case "relay":
		if e.State != "on" && e.State != "off" {
			return e, fmt.Errorf("relay state %q", e.State)
		}
	case "soc":
		if e.Value == nil || *e.Value < 0 || *e.Value > 100 {
			return e, errors.New("soc must be 0–100")
		}
	case "temperature":
		if e.Value == nil || *e.Value < -40 || *e.Value > 85 {
			return e, errors.New("temperature out of range")
		}
	default:
		return e, fmt.Errorf("unknown event type %q", e.Type)
	}
	if e.Ch < 0 || e.Ch >= MaxChannels {
		return e, errors.New("channel out of range")
	}
	return e, nil
}

// Command is sent on marq/dev/{hw}/cmd. Exactly one action is set.
type Command struct {
	ID     int64           `json:"id"`
	Relay  *RelayCmd       `json:"relay,omitempty"`
	HVAC   *HVACCmd        `json:"hvac,omitempty"`
	EV     *EVCmd          `json:"ev,omitempty"`
	Config json.RawMessage `json:"config,omitempty"`
	OTA    *OTACmd         `json:"ota,omitempty"`
}

type RelayCmd struct {
	Ch    int    `json:"ch"`
	State string `json:"state"`
}
type HVACCmd struct {
	Mode      string   `json:"mode"` // comfort | setback | off
	SetpointC *float64 `json:"setpoint_c,omitempty"`
}
type EVCmd struct {
	LimitKW float64 `json:"limit_kw"`
}
type OTACmd struct {
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
}

type Ack struct {
	ID    int64  `json:"id"`
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

// SysEvent is a derived event the ingest service publishes on marq/sys/events.
type SysEvent struct {
	Kind     string    `json:"kind"` // machine_state | offline | online | fault | anomaly | power
	DeviceID string    `json:"device_id"`
	HW       string    `json:"hw"`
	Channel  int       `json:"channel"`
	From     string    `json:"from,omitempty"`
	To       string    `json:"to,omitempty"`
	PowerW   float64   `json:"power_w,omitempty"`
	Message  string    `json:"message,omitempty"`
	TS       time.Time `json:"ts"`
}

const SysEventsTopic = "marq/sys/events"
const HeartbeatTopic = "marq/sys/heartbeat"
