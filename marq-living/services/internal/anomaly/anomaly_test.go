package anomaly

import (
	"strings"
	"testing"
	"time"

	"marq-living/services/internal/registry"
)

var loc, _ = time.LoadLocation("America/Toronto")

func lobby() registry.Device {
	return registry.Device{ID: "d1", Name: "Theatre lights", Config: registry.Config{Channels: map[string]registry.ChannelConfig{
		"0": {Label: "Lights", AfterHoursMaxW: 50, ExpectedHours: &registry.Hours{From: "08:00", To: "23:00"}, MaxW: 2000},
	}}}
}

func TestLightsLeftOnOvernight(t *testing.T) {
	d := NewDetector(loc)
	start := time.Date(2026, 10, 5, 23, 5, 0, 0, loc)
	var got []Finding
	for at := start; at.Before(start.Add(20 * time.Minute)); at = at.Add(5 * time.Second) {
		got = append(got, d.Observe(lobby(), 0, at, 400)...)
	}
	if len(got) != 1 || got[0].Type != "anomaly" || !strings.Contains(got[0].Message, "left on") {
		t.Fatalf("%+v", got)
	}
	// Same load during opening hours is fine.
	d2 := NewDetector(loc)
	day := time.Date(2026, 10, 5, 14, 0, 0, 0, loc)
	for at := day; at.Before(day.Add(time.Hour)); at = at.Add(5 * time.Second) {
		if f := d2.Observe(lobby(), 0, at, 400); len(f) > 0 {
			t.Fatalf("daytime flagged: %+v", f)
		}
	}
}

func TestOverloadFiresOncePerEpisode(t *testing.T) {
	d := NewDetector(loc)
	at := time.Date(2026, 10, 5, 14, 0, 0, 0, loc)
	n := 0
	for i := 0; i < 30; i++ {
		n += len(d.Observe(lobby(), 0, at.Add(time.Duration(i)*5*time.Second), 2500))
	}
	if n != 1 {
		t.Fatalf("fired %d times", n)
	}
	d.Observe(lobby(), 0, at.Add(3*time.Minute), 100) // back to normal re-arms
	n = 0
	for i := 0; i < 10; i++ {
		n += len(d.Observe(lobby(), 0, at.Add(4*time.Minute+time.Duration(i)*5*time.Second), 2500))
	}
	if n != 1 {
		t.Fatalf("second episode fired %d times", n)
	}
}

func TestPresence(t *testing.T) {
	p := NewPresence()
	dev := registry.Device{ID: "d1", Config: registry.Config{IntervalS: 5}}
	now := time.Now()
	p.Seen("d1", now)
	if got := p.Sweep(now.Add(30*time.Second), []registry.Device{dev}); len(got) != 0 {
		t.Fatal("too early")
	}
	if got := p.Sweep(now.Add(61*time.Second), []registry.Device{dev}); len(got) != 1 {
		t.Fatal("should be offline")
	}
	if got := p.Sweep(now.Add(120*time.Second), []registry.Device{dev}); len(got) != 0 {
		t.Fatal("reported twice")
	}
	if !p.Seen("d1", now.Add(130*time.Second)) {
		t.Fatal("should report coming back")
	}
}
