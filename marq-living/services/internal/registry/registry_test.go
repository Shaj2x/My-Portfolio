package registry

import (
	"math"
	"testing"
	"time"
)

func f(v float64) *float64 { return &v }

func TestCalibrate(t *testing.T) {
	d := Device{Calibration: Calibration{Channels: map[string]ChannelCal{
		"0": {CurrentScale: 1.05, CurrentOffsetA: 0.1, Voltage: 120, PowerFactor: 0.9},
	}}}
	i, p := d.Calibrate(0, f(10.1), nil)
	if math.Abs(i-10.5) > 1e-9 || math.Abs(p-10.5*120*0.9) > 1e-6 {
		t.Fatalf("i=%v p=%v", i, p)
	}
	// Device-reported power is scaled, not recomputed.
	_, p = d.Calibrate(0, f(10.1), f(1000))
	if math.Abs(p-1050) > 1e-9 {
		t.Fatalf("p=%v", p)
	}
	// Offset never produces negative current.
	i, _ = d.Calibrate(0, f(0.05), nil)
	if i != 0 {
		t.Fatalf("i=%v", i)
	}
	// Uncalibrated channel: 120 V, PF 1.
	i, p = d.Calibrate(3, nil, f(240))
	if p != 240 || i != 2 {
		t.Fatalf("i=%v p=%v", i, p)
	}
}

func TestInWindow(t *testing.T) {
	at := func(h, m int) time.Time { return time.Date(2026, 1, 1, h, m, 0, 0, time.UTC) }
	day := &Hours{From: "08:00", To: "23:00"}
	if !InWindow(day, at(8, 0)) || InWindow(day, at(23, 0)) || InWindow(day, at(3, 0)) {
		t.Fatal("day window")
	}
	night := &Hours{From: "22:00", To: "06:00"}
	if !InWindow(night, at(23, 30)) || !InWindow(night, at(2, 0)) || InWindow(night, at(12, 0)) {
		t.Fatal("wrapping window")
	}
	if !InWindow(nil, at(3, 0)) || !InWindow(&Hours{From: "x", To: "y"}, at(3, 0)) {
		t.Fatal("missing/invalid window means always expected")
	}
}

func TestCache(t *testing.T) {
	c := NewCache(Device{ID: "1", HW: "ct-a"})
	if _, ok := c.ByHW("ct-a"); !ok {
		t.Fatal("missing")
	}
	c.Set([]Device{{ID: "2", HW: "ct-b"}})
	if _, ok := c.ByHW("ct-a"); ok {
		t.Fatal("stale entry")
	}
	if d, ok := c.ByID("2"); !ok || d.HW != "ct-b" {
		t.Fatal("by id")
	}
}
