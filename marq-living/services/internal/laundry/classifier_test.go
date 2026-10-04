package laundry

import (
	"testing"
	"time"
)

var t0 = time.Date(2026, 10, 4, 18, 0, 0, 0, time.UTC)

type step struct {
	minutes float64
	w       float64
}

// run feeds a piecewise-constant profile sampled every 5 s and returns the
// sequence of states entered.
func run(m *Machine, profile []step) []State {
	var seen []State
	at := t0
	for _, s := range profile {
		end := at.Add(time.Duration(s.minutes * float64(time.Minute)))
		for ; at.Before(end); at = at.Add(5 * time.Second) {
			if c := m.Observe(at, s.w); c != nil {
				seen = append(seen, c.To)
			}
		}
	}
	return seen
}

func eq(a, b []State) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestWasherCycle(t *testing.T) {
	m := NewMachine(DefaultSignature("washer"), Idle)
	got := run(m, []step{
		{2, 3},    // idle
		{5, 60},   // fill
		{2, 2},    // soak: quiet, but shorter than DoneAfter — not finished
		{15, 350}, // wash
		{8, 200},  // rinse
		{6, 520},  // spin
		{5, 2},    // done
	})
	want := []State{Running, Finishing, Idle}
	if !eq(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestDryerCycleWithCooldown(t *testing.T) {
	m := NewMachine(DefaultSignature("dryer"), Idle)
	got := run(m, []step{
		{30, 5300}, // heater + motor
		{3, 300},   // heater cycling off briefly — not cool-down yet (< 2 min would be; 3 min triggers)
		{10, 5300},
		{6, 300}, // cool-down
		{3, 5},
	})
	if got[0] != Running || got[len(got)-1] != Idle {
		t.Fatalf("got %v", got)
	}
	for _, s := range got {
		if s == Fault {
			t.Fatalf("healthy dryer flagged as fault: %v", got)
		}
	}
}

func TestDryerHeaterFailure(t *testing.T) {
	m := NewMachine(DefaultSignature("dryer"), Idle)
	got := run(m, []step{{20, 300}}) // motor only, never heats
	if !eq(got, []State{Running, Fault}) {
		t.Fatalf("got %v", got)
	}
	// Stays faulted until reset.
	if c := m.Observe(t0.Add(time.Hour), 5); c != nil || m.State != Fault {
		t.Fatal("fault should latch")
	}
	m.Reset()
	if m.State != Idle {
		t.Fatal("reset")
	}
}

func TestOverload(t *testing.T) {
	m := NewMachine(DefaultSignature("washer"), Idle)
	got := run(m, []step{{1, 300}, {1, 3000}})
	if !eq(got, []State{Running, Fault}) {
		t.Fatalf("got %v", got)
	}
	// A brief spike under 30 s is ignored.
	m2 := NewMachine(DefaultSignature("washer"), Idle)
	got = run(m2, []step{{1, 300}, {0.25, 3000}, {1, 300}})
	if !eq(got, []State{Running}) {
		t.Fatalf("spike: got %v", got)
	}
}

func TestEstimatedDone(t *testing.T) {
	m := NewMachine(DefaultSignature("washer"), Idle)
	c := m.Observe(t0, 300)
	if c == nil || c.EstDoneAt == nil || !c.EstDoneAt.Equal(t0.Add(35*time.Minute)) {
		t.Fatalf("%+v", c)
	}
}

func TestParseSignatureOverlay(t *testing.T) {
	s := ParseSignature("washer", []byte(`{"cycle_minutes": 50}`))
	if s.CycleMinutes != 50 || s.IdleBelowW != 8 || s.Kind != "washer" {
		t.Fatalf("%+v", s)
	}
}
