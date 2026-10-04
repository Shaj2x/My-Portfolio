// Package laundry classifies washer/dryer state from the power drawn on a CT
// channel, and detects faults from the power signature.
//
//	idle      power below IdleBelowW (after DoneAfter of quiet, so pauses
//	          mid-cycle — soaking, tumbling with heater cycling off — don't
//	          count as finished)
//	running   a cycle is in progress
//	finishing the last part of the cycle: elapsed ≥ FinishingAt × typical
//	          length, or (dryers) heater off with only the motor running
//	          (cool-down)
//	fault     signature says the machine is broken: power above MaxW (motor
//	          stall), or a dryer running motor-only for longer than its
//	          cool-down (heating element failed)
package laundry

import (
	"encoding/json"
	"time"
)

type State string

const (
	Idle      State = "idle"
	Running   State = "running"
	Finishing State = "finishing"
	Fault     State = "fault"
)

type Signature struct {
	Kind          string  `json:"-"`
	IdleBelowW    float64 `json:"idle_below_w"`
	RunningAboveW float64 `json:"running_above_w"`
	CycleMinutes  float64 `json:"cycle_minutes"`
	FinishingAt   float64 `json:"finishing_at"`
	DoneAfterS    float64 `json:"done_after_s"`
	MaxW          float64 `json:"max_w"`
	// Dryers: heater on above this; motor-only between RunningAboveW and this.
	HeaterAboveW   float64 `json:"heater_above_w"`
	CooldownMaxMin float64 `json:"cooldown_max_minutes"`
}

// DefaultSignature is a reasonable starting point for common coin-op
// machines; tune per machine in laundry_machines.signature.
func DefaultSignature(kind string) Signature {
	if kind == "dryer" {
		return Signature{Kind: "dryer", IdleBelowW: 15, RunningAboveW: 100, CycleMinutes: 50, FinishingAt: 0.85,
			DoneAfterS: 90, MaxW: 7500, HeaterAboveW: 1500, CooldownMaxMin: 12}
	}
	return Signature{Kind: "washer", IdleBelowW: 8, RunningAboveW: 40, CycleMinutes: 35, FinishingAt: 0.8,
		DoneAfterS: 180, MaxW: 2200}
}

// ParseSignature overlays a stored JSON signature on the defaults.
func ParseSignature(kind string, raw []byte) Signature {
	s := DefaultSignature(kind)
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &s)
	}
	s.Kind = kind
	return s
}

type Change struct {
	From, To  State
	At        time.Time
	EstDoneAt *time.Time
	Reason    string
}

// Machine is the per-machine state machine. Not safe for concurrent use.
type Machine struct {
	Sig        Signature
	State      State
	cycleStart time.Time
	quietSince time.Time
	overSince  time.Time
	motorSince time.Time
	sawHeater  bool
}

func NewMachine(sig Signature, initial State) *Machine {
	if initial == "" || initial == "offline" {
		initial = Idle
	}
	return &Machine{Sig: sig, State: initial}
}

func (m *Machine) estDone() *time.Time {
	if m.cycleStart.IsZero() {
		return nil
	}
	t := m.cycleStart.Add(time.Duration(m.Sig.CycleMinutes * float64(time.Minute)))
	return &t
}

func (m *Machine) to(s State, at time.Time, reason string) *Change {
	if s == m.State {
		return nil
	}
	c := &Change{From: m.State, To: s, At: at, Reason: reason}
	m.State = s
	if s == Running || s == Finishing {
		c.EstDoneAt = m.estDone()
	}
	return c
}

// Observe feeds one power sample and returns a state change, if any. A
// machine in Fault stays there until Reset (staff resolve the ticket).
func (m *Machine) Observe(at time.Time, powerW float64) *Change {
	s := m.Sig
	if m.State == Fault {
		return nil
	}

	// Overload: above MaxW for 30 s.
	if s.MaxW > 0 && powerW > s.MaxW {
		if m.overSince.IsZero() {
			m.overSince = at
		} else if at.Sub(m.overSince) >= 30*time.Second {
			return m.to(Fault, at, "drawing more power than the machine is rated for")
		}
	} else {
		m.overSince = time.Time{}
	}

	active := powerW >= s.RunningAboveW
	switch m.State {
	case Idle:
		if active {
			m.cycleStart, m.quietSince, m.motorSince, m.sawHeater = at, time.Time{}, time.Time{}, false
			return m.to(Running, at, "cycle started")
		}
		return nil
	}

	// Running or finishing.
	if powerW < s.IdleBelowW {
		if m.quietSince.IsZero() {
			m.quietSince = at
		}
		if at.Sub(m.quietSince).Seconds() >= s.DoneAfterS {
			m.cycleStart = time.Time{}
			return m.to(Idle, at, "cycle finished")
		}
		return nil
	}
	m.quietSince = time.Time{}

	if s.Kind == "dryer" && s.HeaterAboveW > 0 {
		if powerW >= s.HeaterAboveW {
			m.sawHeater = true
			m.motorSince = time.Time{}
		} else if active {
			if m.motorSince.IsZero() {
				m.motorSince = at
			}
			motorFor := at.Sub(m.motorSince).Minutes()
			if !m.sawHeater && motorFor >= s.CooldownMaxMin {
				return m.to(Fault, at, "dryer is tumbling but the heating element isn't drawing power")
			}
			if m.sawHeater && motorFor >= 2 {
				return m.to(Finishing, at, "cool-down")
			}
		}
	}

	if m.State == Running && at.Sub(m.cycleStart).Minutes() >= s.FinishingAt*s.CycleMinutes {
		return m.to(Finishing, at, "near the end of a typical cycle")
	}
	return nil
}

// Reset returns a faulted machine to service.
func (m *Machine) Reset() {
	*m = Machine{Sig: m.Sig, State: Idle}
}
