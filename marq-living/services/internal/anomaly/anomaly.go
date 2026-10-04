// Package anomaly flags loads that run outside expected hours, overloads,
// and devices that stop reporting.
package anomaly

import (
	"fmt"
	"sync"
	"time"

	"marq-living/services/internal/registry"
)

const (
	AfterHoursFor = 15 * time.Minute
	OverloadFor   = 30 * time.Second
)

type Finding struct {
	Type    string // "anomaly" | "fault"
	Channel int
	PowerW  float64
	Message string
}

type key struct {
	dev string
	ch  int
}

type track struct {
	afterSince time.Time
	overSince  time.Time
	afterFired bool
	overFired  bool
}

// Detector keeps per-channel timers. Each condition fires once per episode
// and re-arms when the load returns to normal.
type Detector struct {
	mu  sync.Mutex
	loc *time.Location
	t   map[key]*track
}

func NewDetector(loc *time.Location) *Detector {
	return &Detector{loc: loc, t: map[key]*track{}}
}

func (d *Detector) Observe(dev registry.Device, ch int, at time.Time, powerW float64) []Finding {
	cfg := dev.Channel(ch)
	d.mu.Lock()
	defer d.mu.Unlock()
	k := key{dev.ID, ch}
	tr := d.t[k]
	if tr == nil {
		tr = &track{}
		d.t[k] = tr
	}
	var out []Finding
	label := cfg.Label
	if label == "" {
		label = fmt.Sprintf("channel %d", ch)
	}

	if cfg.MaxW > 0 && powerW > cfg.MaxW {
		if tr.overSince.IsZero() {
			tr.overSince = at
		}
		if !tr.overFired && at.Sub(tr.overSince) >= OverloadFor {
			tr.overFired = true
			out = append(out, Finding{"fault", ch, powerW, fmt.Sprintf("%s on %s is drawing %.0f W, above its %.0f W limit", label, dev.Name, powerW, cfg.MaxW)})
		}
	} else {
		tr.overSince, tr.overFired = time.Time{}, false
	}

	local := at.In(d.loc)
	if cfg.ExpectedHours != nil && cfg.AfterHoursMaxW > 0 && !registry.InWindow(cfg.ExpectedHours, local) && powerW > cfg.AfterHoursMaxW {
		if tr.afterSince.IsZero() {
			tr.afterSince = at
		}
		if !tr.afterFired && at.Sub(tr.afterSince) >= AfterHoursFor {
			tr.afterFired = true
			out = append(out, Finding{"anomaly", ch, powerW, fmt.Sprintf("%s on %s has been drawing %.0f W since %s, outside its %s–%s hours (left on?)",
				label, dev.Name, powerW, tr.afterSince.In(d.loc).Format("15:04"), cfg.ExpectedHours.From, cfg.ExpectedHours.To)})
		}
	} else {
		tr.afterSince, tr.afterFired = time.Time{}, false
	}
	return out
}

// Presence tracks last-seen times and reports devices that went silent.
type Presence struct {
	mu      sync.Mutex
	last    map[string]time.Time
	offline map[string]bool
}

func NewPresence() *Presence {
	return &Presence{last: map[string]time.Time{}, offline: map[string]bool{}}
}

// Seen records activity; returns true if the device was offline (now back).
func (p *Presence) Seen(deviceID string, at time.Time) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if at.After(p.last[deviceID]) {
		p.last[deviceID] = at
	}
	back := p.offline[deviceID]
	delete(p.offline, deviceID)
	return back
}

// MarkOffline records an explicit offline (Last Will). Returns true if newly offline.
func (p *Presence) MarkOffline(deviceID string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.offline[deviceID] {
		return false
	}
	p.offline[deviceID] = true
	return true
}

// Sweep returns devices silent for longer than 3 × their interval (min 60 s)
// that weren't already reported.
func (p *Presence) Sweep(now time.Time, devs []registry.Device) []registry.Device {
	p.mu.Lock()
	defer p.mu.Unlock()
	var out []registry.Device
	for _, d := range devs {
		last, ok := p.last[d.ID]
		if !ok || p.offline[d.ID] {
			continue
		}
		limit := 3 * d.Interval()
		if limit < 60*time.Second {
			limit = 60 * time.Second
		}
		if now.Sub(last) > limit {
			p.offline[d.ID] = true
			out = append(out, d)
		}
	}
	return out
}
