package automation

import (
	"testing"
	"time"
)

var loc, _ = time.LoadLocation("America/Toronto")
var t0 = time.Date(2026, 10, 7, 18, 0, 0, 0, loc)

func mustRule(t *testing.T, id, trigger, conditions, actions string) Rule {
	t.Helper()
	r, err := ParseRule(id, id, 100, []byte(trigger), []byte(conditions), []byte(actions))
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func defaultRules(t *testing.T) []Rule {
	return []Rule{
		mustRule(t, "preheat", `{"type":"booking.starting","room":"*","minutes":15}`, `[]`,
			`[{"type":"set_lights","room":"$room","state":"on"},{"type":"set_hvac","room":"$room","mode":"comfort"}]`),
		mustRule(t, "powerdown", `{"type":"booking.ended","room":"*","wait_up_to_minutes":60}`,
			`[{"type":"no_motion_for","room":"$room","minutes":10},{"type":"no_active_booking","room":"$room"}]`,
			`[{"type":"set_lights","room":"$room","state":"off"},{"type":"set_hvac","room":"$room","mode":"setback"}]`),
		mustRule(t, "unbooked", `{"type":"motion.detected","room":"*","cooldown_minutes":60}`,
			`[{"type":"no_active_booking","room":"$room","minutes":15}]`,
			`[{"type":"notify_staff","title":"$room in use without a booking","body":"Motion detected."}]`),
	}
}

func snap(now time.Time, rooms map[string]*RoomState, bookings ...Booking) Snapshot {
	return Snapshot{Now: now, Rooms: rooms, Bookings: bookings, Motion: map[string]bool{}}
}

func theatre() map[string]*RoomState {
	return map[string]*RoomState{"theatre": {Slug: "theatre", Name: "Theatre Room", Override: "auto", Lights: "off", HVAC: "setback"}}
}

func kinds(ps []Planned) []string {
	var out []string
	for _, p := range ps {
		v := p.Action.State + p.Action.Mode
		if p.Action.Type == "notify_staff" {
			v = p.Action.Title
		}
		out = append(out, p.Action.Type+":"+v)
	}
	return out
}

func TestPreheatBeforeBookingOnce(t *testing.T) {
	e := NewEngine(t0)
	rooms := theatre()
	b := Booking{ID: "b1", Room: "theatre", Start: t0.Add(30 * time.Minute), End: t0.Add(150 * time.Minute)}
	if a, _ := e.Evaluate(defaultRules(t), snap(t0, rooms, b)); len(a) != 0 {
		t.Fatalf("too early: %v", kinds(a))
	}
	a, _ := e.Evaluate(defaultRules(t), snap(t0.Add(16*time.Minute), rooms, b))
	if got := kinds(a); len(got) != 2 || got[0] != "set_lights:on" || got[1] != "set_hvac:comfort" {
		t.Fatalf("preheat: %v", got)
	}
	if a[0].Reason == "" || a[0].Rule.ID != "preheat" {
		t.Fatal("actions carry rule and reason for the command log")
	}
	rooms["theatre"].Lights, rooms["theatre"].HVAC = "", ""
	if a, _ := e.Evaluate(defaultRules(t), snap(t0.Add(17*time.Minute), rooms, b)); len(a) != 0 {
		t.Fatalf("fired twice: %v", kinds(a))
	}
}

func TestPowerDownWaitsForRoomToEmpty(t *testing.T) {
	e := NewEngine(t0)
	rooms := theatre()
	rooms["theatre"].Lights, rooms["theatre"].HVAC = "on", "comfort"
	b := Booking{ID: "b1", Room: "theatre", Start: t0.Add(-2 * time.Hour), End: t0}
	// Booking just ended but people are still there (motion 2 min ago).
	rooms["theatre"].LastMotion = t0.Add(-2 * time.Minute)
	if a, _ := e.Evaluate(defaultRules(t), snap(t0.Add(time.Minute), rooms, b)); len(a) != 0 {
		t.Fatalf("powered down an occupied room: %v", kinds(a))
	}
	if e.Waiting() != 1 {
		t.Fatalf("trigger should stay armed, waiting=%d", e.Waiting())
	}
	// Last motion at +5; 10 min later the room is empty.
	rooms["theatre"].LastMotion = t0.Add(5 * time.Minute)
	if a, _ := e.Evaluate(defaultRules(t), snap(t0.Add(12*time.Minute), rooms, b)); len(a) != 0 {
		t.Fatalf("too soon: %v", kinds(a))
	}
	a, _ := e.Evaluate(defaultRules(t), snap(t0.Add(16*time.Minute), rooms, b))
	if got := kinds(a); len(got) != 2 || got[0] != "set_lights:off" || got[1] != "set_hvac:setback" {
		t.Fatalf("power down: %v", got)
	}
	if e.Waiting() != 0 {
		t.Fatal("armed trigger should clear")
	}
}

func TestArmedTriggerExpires(t *testing.T) {
	e := NewEngine(t0)
	rooms := theatre()
	rooms["theatre"].Lights = "on"
	b := Booking{ID: "b1", Room: "theatre", Start: t0.Add(-time.Hour), End: t0}
	rooms["theatre"].LastMotion = t0
	e.Evaluate(defaultRules(t), snap(t0.Add(time.Minute), rooms, b))
	for m := 2; m < 62; m++ {
		rooms["theatre"].LastMotion = t0.Add(time.Duration(m) * time.Minute) // someone stays
		e.Evaluate(defaultRules(t), snap(t0.Add(time.Duration(m)*time.Minute), rooms, b))
	}
	if a, _ := e.Evaluate(defaultRules(t), snap(t0.Add(62*time.Minute), rooms, b)); len(a) != 0 || e.Waiting() != 0 {
		t.Fatalf("should give up after wait_up_to_minutes: %v waiting=%d", kinds(a), e.Waiting())
	}
}

func TestManualOverrideWins(t *testing.T) {
	e := NewEngine(t0)
	rooms := theatre()
	rooms["theatre"].Override = "force_off"
	b := Booking{ID: "b1", Room: "theatre", Start: t0.Add(10 * time.Minute), End: t0.Add(time.Hour)}
	a, skipped := e.Evaluate(defaultRules(t), snap(t0, rooms, b))
	if len(a) != 0 || len(skipped) != 2 {
		t.Fatalf("override must block automation: actions=%v skipped=%d", kinds(a), len(skipped))
	}
}

func TestUnbookedUseAlertWithCooldownAndGrace(t *testing.T) {
	e := NewEngine(t0)
	rooms := theatre()
	s := snap(t0, rooms)
	s.Motion["theatre"] = true
	a, _ := e.Evaluate(defaultRules(t), s)
	if got := kinds(a); len(got) != 1 || got[0] != "notify_staff:Theatre Room in use without a booking" {
		t.Fatalf("alert: %v", got)
	}
	s.Now = t0.Add(30 * time.Minute)
	if a, _ := e.Evaluate(defaultRules(t), s); len(a) != 0 {
		t.Fatal("cooldown")
	}
	// Someone arriving 10 minutes early for their booking isn't "unbooked".
	e2 := NewEngine(t0)
	s2 := snap(t0, theatre(), Booking{ID: "b", Room: "theatre", Start: t0.Add(10 * time.Minute), End: t0.Add(time.Hour)})
	s2.Motion["theatre"] = true
	for _, p := range func() []Planned { a, _ := e2.Evaluate(defaultRules(t)[2:], s2); return a }() {
		t.Fatalf("early arrival flagged: %v", p.Action.Title)
	}
}

func TestVacancyAndSchedule(t *testing.T) {
	e := NewEngine(t0)
	rooms := theatre()
	rooms["theatre"].Lights = "on"
	rooms["theatre"].LastMotion = t0
	rules := []Rule{
		mustRule(t, "vacant", `{"type":"room.vacant","room":"*","minutes":20}`, `[{"type":"no_active_booking","room":"$room"}]`,
			`[{"type":"set_lights","room":"$room","state":"off"}]`),
		mustRule(t, "nightly", `{"type":"schedule","at":"23:30"}`, `[]`,
			`[{"type":"set_hvac","room":"theatre","mode":"setback"}]`),
	}
	if a, _ := e.Evaluate(rules, snap(t0.Add(19*time.Minute), rooms)); len(a) != 0 {
		t.Fatal("not vacant yet")
	}
	if a, _ := e.Evaluate(rules, snap(t0.Add(21*time.Minute), rooms)); len(a) != 1 {
		t.Fatal("vacant")
	}
	if a, _ := e.Evaluate(rules, snap(t0.Add(25*time.Minute), rooms)); len(a) != 0 {
		t.Fatal("vacancy fires once per episode")
	}
	night := time.Date(2026, 10, 7, 23, 31, 0, 0, loc)
	rooms["theatre"].HVAC = "comfort"
	if a, _ := e.Evaluate(rules, snap(night, rooms)); len(a) != 1 || a[0].Action.Mode != "setback" {
		t.Fatalf("schedule: %v", kinds(a))
	}
	if a, _ := e.Evaluate(rules, snap(night.Add(2*time.Minute), rooms)); len(a) != 0 {
		t.Fatal("schedule once a day")
	}
}

func TestParseRuleRejects(t *testing.T) {
	bad := [][3]string{
		{`{"type":"teleport"}`, `[]`, `[{"type":"set_lights","room":"x","state":"on"}]`},
		{`{"type":"motion.detected"}`, `[{"type":"astrology"}]`, `[{"type":"set_lights","room":"x","state":"on"}]`},
		{`{"type":"motion.detected"}`, `[]`, `[]`},
		{`{"type":"motion.detected"}`, `[]`, `[{"type":"set_lights","room":"x","state":"dim"}]`},
		{`{"type":"motion.detected"}`, `[]`, `[{"type":"set_hvac","mode":"comfort"}]`},
		{`{"type":"schedule","at":"25:99"}`, `[]`, `[{"type":"notify_staff","title":"x"}]`},
		{`{"type":"motion.detected"}`, `[]`, `[{"type":"notify_staff","title":" "}]`},
	}
	for _, b := range bad {
		if _, err := ParseRule("x", "x", 1, []byte(b[0]), []byte(b[1]), []byte(b[2])); err == nil {
			t.Errorf("accepted %v", b)
		}
	}
}

func TestPricePeriodCondition(t *testing.T) {
	e := NewEngine(t0)
	rooms := theatre()
	rooms["theatre"].HVAC = "comfort"
	r := mustRule(t, "peak", `{"type":"schedule","at":"16:00"}`, `[{"type":"price_period","in":["on_peak"]}]`,
		`[{"type":"set_hvac","room":"theatre","mode":"setback"}]`)
	s := snap(time.Date(2026, 10, 7, 16, 1, 0, 0, loc), rooms)
	s.PricePeriod = "mid_peak"
	if a, _ := e.Evaluate([]Rule{r}, s); len(a) != 0 {
		t.Fatal("wrong period")
	}
	e2 := NewEngine(t0)
	s.PricePeriod = "on_peak"
	if a, _ := e2.Evaluate([]Rule{r}, s); len(a) != 1 {
		t.Fatal("on-peak pre-cool/setback")
	}
}
