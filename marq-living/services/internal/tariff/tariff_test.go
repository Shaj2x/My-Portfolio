package tariff

import (
	"testing"
	"time"
)

func at(y int, m time.Month, d, h int) time.Time { return time.Date(y, m, d, h, 0, 0, 0, Loc) }

// Same cases as analytics/tests/test_tariffs.py so the two stay in step.
func TestPeriods(t *testing.T) {
	cases := []struct {
		plan string
		t    time.Time
		want string
	}{
		{"ulo", at(2026, 10, 7, 23), "ultra_low"},
		{"ulo", at(2026, 10, 7, 16), "on_peak"},
		{"ulo", at(2026, 10, 7, 21), "mid_peak"},
		{"ulo", at(2026, 10, 10, 16), "weekend_off_peak"},
		{"ulo", at(2026, 10, 12, 17), "weekend_off_peak"}, // Thanksgiving
		{"tou", at(2026, 1, 14, 8), "on_peak"},
		{"tou", at(2026, 1, 14, 13), "mid_peak"},
		{"tou", at(2026, 7, 15, 13), "on_peak"},
		{"tou", at(2026, 7, 15, 8), "mid_peak"},
		{"tou", at(2026, 7, 15, 20), "off_peak"},
		{"tou", at(2026, 12, 28, 12), "off_peak"}, // Boxing Day observed
	}
	for _, c := range cases {
		if got := Period(c.plan, c.t); got != c.want {
			t.Errorf("%s %v: got %s want %s", c.plan, c.t, got, c.want)
		}
	}
}
