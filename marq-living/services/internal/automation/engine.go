package automation

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// Booking is a confirmed booking of a room's amenity.
type Booking struct {
	ID         string
	Room       string
	Start, End time.Time
}

// RoomState is what the engine knows about one automated room.
type RoomState struct {
	Slug       string
	Name       string
	Override   string // auto | force_on | force_off
	LastMotion time.Time
	Lights     string // on | off | "" (unknown)
	HVAC       string // comfort | setback | off | ""
	PreheatMin int
}

// Snapshot is the world as of one evaluation.
type Snapshot struct {
	Now      time.Time // building local time
	Rooms    map[string]*RoomState
	Bookings []Booking
	// Motion events since the last evaluation, by room.
	Motion map[string]bool
	// Device events since the last evaluation (fault / anomaly), as messages.
	DeviceEvents []DeviceEvent
	PricePeriod  string
}

type DeviceEvent struct {
	Kind    string // fault | anomaly
	Room    string
	Message string
}

// Planned is one action the engine decided to take.
type Planned struct {
	Rule   Rule
	Room   string
	Action Action
	Reason string
}

type armed struct {
	rule   Rule
	room   string
	until  time.Time
	reason string
}

// Engine holds the memory needed to fire each trigger once: bookings seen
// starting/ended, vacancy episodes, schedule days, cooldowns, and armed
// (waiting) triggers. Not safe for concurrent use.
type Engine struct {
	fired     map[string]bool      // rule|key → already fired (bookings, schedules, vacancy episodes)
	lastFired map[string]time.Time // rule|room → last time (cooldown)
	waiting   map[string]armed     // rule|room|key → armed trigger
	started   time.Time
}

func NewEngine(now time.Time) *Engine {
	return &Engine{fired: map[string]bool{}, lastFired: map[string]time.Time{}, waiting: map[string]armed{}, started: now}
}

// Evaluate runs every rule against the snapshot and returns actions to take,
// in rule priority order. Physical actions for rooms under manual override
// are dropped (the override always wins) and reported as skipped.
func (e *Engine) Evaluate(rules []Rule, s Snapshot) (actions []Planned, skipped []Planned) {
	sort.SliceStable(rules, func(i, j int) bool { return rules[i].Priority < rules[j].Priority })
	type firing struct {
		rule   Rule
		room   string
		key    string
		reason string
	}
	var fires []firing

	for _, r := range rules {
		t := r.Trigger
		for slug, room := range s.Rooms {
			if !t.matchesRoom(slug) {
				continue
			}
			switch t.Type {
			case "booking.starting", "booking.started", "booking.ended":
				lead := time.Duration(t.Minutes) * time.Minute
				if t.Type == "booking.starting" && t.Minutes == 0 {
					lead = time.Duration(room.PreheatMin) * time.Minute
				}
				for _, b := range s.Bookings {
					if b.Room != slug {
						continue
					}
					var at, until time.Time
					switch t.Type {
					case "booking.starting":
						at, until = b.Start.Add(-lead), b.End
					case "booking.started":
						at, until = b.Start, b.End
					default:
						at, until = b.End, b.End.Add(6*time.Hour)
					}
					// Fire once when its moment has passed (but not for bookings
					// that ended long before the engine started).
					if !s.Now.Before(at) && s.Now.Before(until) && at.After(e.started.Add(-6*time.Hour)) {
						fires = append(fires, firing{r, slug, t.Type + "|" + b.ID, fmt.Sprintf("%s (booking %s–%s)", humanTrigger(t.Type), b.Start.Format("15:04"), b.End.Format("15:04"))})
					}
				}
			case "motion.detected":
				if s.Motion[slug] {
					fires = append(fires, firing{r, slug, "", "motion detected"})
				}
			case "room.vacant":
				mins := t.Minutes
				if mins <= 0 {
					mins = 15
				}
				vacant := !room.LastMotion.IsZero() && s.Now.Sub(room.LastMotion) >= time.Duration(mins)*time.Minute
				key := "vacant|" + room.LastMotion.Format(time.RFC3339)
				if vacant {
					fires = append(fires, firing{r, slug, key, fmt.Sprintf("no motion for %d min", mins)})
				}
			case "device.fault", "device.anomaly":
				for _, ev := range s.DeviceEvents {
					if "device."+ev.Kind == t.Type && (ev.Room == slug || (ev.Room == "" && slug == firstRoom(s.Rooms))) {
						fires = append(fires, firing{r, slug, "", ev.Message})
					}
				}
			}
		}
		if t.Type == "schedule" {
			at, _ := clock(t.At)
			now := s.Now.Hour()*60 + s.Now.Minute()
			if now >= at && now < at+5 && dayOK(t.Days, s.Now) {
				key := "schedule|" + s.Now.Format("2006-01-02")
				fires = append(fires, firing{r, "", key, "scheduled at " + t.At})
			}
		}
	}

	// Resolve fires: once-per-key, cooldown, then conditions now or armed.
	for _, f := range fires {
		id := f.rule.ID + "|" + f.room + "|" + f.key
		if f.key != "" {
			if e.fired[id] {
				continue
			}
			e.fired[id] = true
		}
		if cd := f.rule.Trigger.CooldownMinutes; cd > 0 {
			if last, ok := e.lastFired[f.rule.ID+"|"+f.room]; ok && s.Now.Sub(last) < time.Duration(cd)*time.Minute {
				continue
			}
		}
		if e.conditions(f.rule, f.room, s) {
			e.lastFired[f.rule.ID+"|"+f.room] = s.Now
			a, sk := expand(f.rule, f.room, f.reason, s)
			actions, skipped = append(actions, a...), append(skipped, sk...)
		} else if w := f.rule.Trigger.WaitUpToMinutes; w > 0 {
			e.waiting[id] = armed{rule: f.rule, room: f.room, until: s.Now.Add(time.Duration(w) * time.Minute), reason: f.reason}
		}
	}

	// Armed triggers: fire once conditions hold, or expire.
	for id, w := range e.waiting {
		if s.Now.After(w.until) {
			delete(e.waiting, id)
			continue
		}
		if e.conditions(w.rule, w.room, s) {
			delete(e.waiting, id)
			e.lastFired[w.rule.ID+"|"+w.room] = s.Now
			a, sk := expand(w.rule, w.room, w.reason, s)
			actions, skipped = append(actions, a...), append(skipped, sk...)
		}
	}
	return actions, skipped
}

// Waiting reports how many triggers are armed (for status pages and tests).
func (e *Engine) Waiting() int { return len(e.waiting) }

func (e *Engine) conditions(r Rule, firing string, s Snapshot) bool {
	for _, c := range r.Conditions {
		room := s.Rooms[roomOf(c.Room, firing)]
		switch c.Type {
		case "no_motion_for", "motion_within":
			if room == nil {
				return false
			}
			recent := !room.LastMotion.IsZero() && s.Now.Sub(room.LastMotion) < time.Duration(c.Minutes)*time.Minute
			if (c.Type == "no_motion_for") == recent {
				return false
			}
		case "no_active_booking", "active_booking":
			if room == nil {
				return false
			}
			if (c.Type == "active_booking") != activeBooking(s, room.Slug, time.Duration(c.Minutes)*time.Minute) {
				return false
			}
		case "time_between":
			if !inWindow(c.From, c.To, s.Now) {
				return false
			}
		case "price_period":
			ok := false
			for _, p := range c.In {
				ok = ok || p == s.PricePeriod
			}
			if !ok {
				return false
			}
		}
	}
	return true
}

// activeBooking: a booking is in progress, or starts within `early`.
func activeBooking(s Snapshot, room string, early time.Duration) bool {
	for _, b := range s.Bookings {
		if b.Room == room && !s.Now.Before(b.Start.Add(-early)) && s.Now.Before(b.End) {
			return true
		}
	}
	return false
}

func expand(r Rule, firing, reason string, s Snapshot) (out, skipped []Planned) {
	for _, a := range r.Actions {
		room := roomOf(a.Room, firing)
		p := Planned{Rule: r, Room: room, Action: a, Reason: fmt.Sprintf("%s: %s", r.Name, reason)}
		if a.Type == "set_lights" || a.Type == "set_hvac" {
			st := s.Rooms[room]
			if st == nil {
				continue
			}
			if st.Override == "force_on" || st.Override == "force_off" {
				skipped = append(skipped, p)
				continue
			}
			// Already in that state: nothing to do.
			if (a.Type == "set_lights" && st.Lights == a.State) || (a.Type == "set_hvac" && st.HVAC == a.Mode) {
				continue
			}
		}
		if a.Type == "notify_staff" {
			name := firing
			if st := s.Rooms[firing]; st != nil {
				name = st.Name
			}
			p.Action.Title = strings.ReplaceAll(a.Title, "$room", name)
			p.Action.Body = strings.ReplaceAll(a.Body, "$room", name)
		}
		out = append(out, p)
	}
	return out, skipped
}

func dayOK(days []int, t time.Time) bool {
	if len(days) == 0 {
		return true
	}
	for _, d := range days {
		if d == int(t.Weekday()) {
			return true
		}
	}
	return false
}

func firstRoom(rooms map[string]*RoomState) string {
	keys := make([]string, 0, len(rooms))
	for k := range rooms {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	if len(keys) == 0 {
		return ""
	}
	return keys[0]
}

func humanTrigger(t string) string {
	switch t {
	case "booking.starting":
		return "booking about to start"
	case "booking.started":
		return "booking started"
	case "booking.ended":
		return "booking ended"
	}
	return t
}
