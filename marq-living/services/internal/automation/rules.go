// Package automation evaluates "when X, do Y" rules against bookings,
// occupancy, device events and the clock, and turns them into physical
// actions (control commands) and notifications.
//
// Rule JSON (stored in public.automation_rules):
//
//	trigger:    {"type": "booking.starting", "room": "*", "minutes": 15}
//	            {"type": "booking.started" | "booking.ended", "room": "theatre", "wait_up_to_minutes": 60}
//	            {"type": "motion.detected", "room": "*"}
//	            {"type": "room.vacant", "room": "*", "minutes": 20}
//	            {"type": "schedule", "at": "23:30", "days": [0,1,2,3,4,5,6]}
//	            {"type": "device.fault" | "device.anomaly"}
//	conditions: [{"type": "no_motion_for", "room": "$room", "minutes": 10},
//	             {"type": "motion_within", "room": "$room", "minutes": 5},
//	             {"type": "no_active_booking" | "active_booking", "room": "$room", "minutes": 15}
//	               (minutes: also count a booking starting within that long),
//	             {"type": "time_between", "from": "23:00", "to": "07:00"},
//	             {"type": "price_period", "in": ["on_peak"]}]
//	actions:    [{"type": "set_lights", "room": "$room", "state": "on" | "off"},
//	             {"type": "set_hvac", "room": "$room", "mode": "comfort" | "setback" | "off"},
//	             {"type": "notify_staff", "title": "…", "body": "…"}]
//
// "room": "*" in a trigger matches every room; "$room" in conditions and
// actions refers to the room that fired. A trigger with wait_up_to_minutes
// stays armed until its conditions hold (e.g. "booking ended" → wait for the
// room to empty), or gives up after that long. cooldown_minutes limits how
// often a rule may fire per room.
package automation

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type Trigger struct {
	Type            string `json:"type"`
	Room            string `json:"room"`
	Minutes         int    `json:"minutes"`
	At              string `json:"at"`
	Days            []int  `json:"days"`
	WaitUpToMinutes int    `json:"wait_up_to_minutes"`
	CooldownMinutes int    `json:"cooldown_minutes"`
}

type Condition struct {
	Type    string   `json:"type"`
	Room    string   `json:"room"`
	Minutes int      `json:"minutes"`
	From    string   `json:"from"`
	To      string   `json:"to"`
	In      []string `json:"in"`
}

type Action struct {
	Type  string `json:"type"`
	Room  string `json:"room"`
	State string `json:"state"`
	Mode  string `json:"mode"`
	Title string `json:"title"`
	Body  string `json:"body"`
}

type Rule struct {
	ID         string
	Name       string
	Priority   int
	Trigger    Trigger
	Conditions []Condition
	Actions    []Action
}

var triggerTypes = map[string]bool{"booking.starting": true, "booking.started": true, "booking.ended": true,
	"motion.detected": true, "room.vacant": true, "schedule": true, "device.fault": true, "device.anomaly": true}
var conditionTypes = map[string]bool{"no_motion_for": true, "motion_within": true, "no_active_booking": true,
	"active_booking": true, "time_between": true, "price_period": true}

// ParseRule validates stored JSON. The web rule editor runs the same checks
// (lib/rules.ts) so bad rules are caught before they're saved.
func ParseRule(id, name string, priority int, trigger, conditions, actions []byte) (Rule, error) {
	r := Rule{ID: id, Name: name, Priority: priority}
	if err := json.Unmarshal(trigger, &r.Trigger); err != nil {
		return r, fmt.Errorf("trigger: %w", err)
	}
	if len(conditions) > 0 {
		if err := json.Unmarshal(conditions, &r.Conditions); err != nil {
			return r, fmt.Errorf("conditions: %w", err)
		}
	}
	if err := json.Unmarshal(actions, &r.Actions); err != nil {
		return r, fmt.Errorf("actions: %w", err)
	}
	if !triggerTypes[r.Trigger.Type] {
		return r, fmt.Errorf("unknown trigger %q", r.Trigger.Type)
	}
	if r.Trigger.Type == "schedule" {
		if _, ok := clock(r.Trigger.At); !ok {
			return r, fmt.Errorf("schedule needs at: HH:MM")
		}
	}
	for _, c := range r.Conditions {
		if !conditionTypes[c.Type] {
			return r, fmt.Errorf("unknown condition %q", c.Type)
		}
	}
	if len(r.Actions) == 0 {
		return r, fmt.Errorf("rule needs at least one action")
	}
	for _, a := range r.Actions {
		switch a.Type {
		case "set_lights":
			if a.State != "on" && a.State != "off" {
				return r, fmt.Errorf("set_lights state must be on/off")
			}
		case "set_hvac":
			if a.Mode != "comfort" && a.Mode != "setback" && a.Mode != "off" {
				return r, fmt.Errorf("set_hvac mode must be comfort/setback/off")
			}
		case "notify_staff":
			if strings.TrimSpace(a.Title) == "" {
				return r, fmt.Errorf("notify_staff needs a title")
			}
		default:
			return r, fmt.Errorf("unknown action %q", a.Type)
		}
		if (a.Type == "set_lights" || a.Type == "set_hvac") && a.Room == "" {
			return r, fmt.Errorf("%s needs a room", a.Type)
		}
	}
	return r, nil
}

// roomOf resolves "$room" to the firing room.
func roomOf(ref, firing string) string {
	if ref == "$room" || ref == "" {
		return firing
	}
	return ref
}

func (t Trigger) matchesRoom(room string) bool {
	return t.Room == "*" || t.Room == "" || t.Room == room
}

// clock parses "HH:MM" into minutes after midnight.
func clock(s string) (int, bool) {
	var h, m int
	if _, err := fmt.Sscanf(s, "%d:%d", &h, &m); err != nil || h < 0 || h > 24 || m < 0 || m > 59 {
		return 0, false
	}
	return h*60 + m, true
}

func inWindow(from, to string, t time.Time) bool {
	f, ok1 := clock(from)
	e, ok2 := clock(to)
	if !ok1 || !ok2 {
		return false
	}
	m := t.Hour()*60 + t.Minute()
	if f <= e {
		return m >= f && m < e
	}
	return m >= f || m < e
}
