// Package tariff mirrors analytics/marq_analytics/tariffs.py: Ontario TOU and
// ULO price periods (weekends and TOU holidays off-peak).
package tariff

import "time"

var Loc, _ = time.LoadLocation("America/Toronto")

func Period(plan string, t time.Time) string {
	l := t.In(Loc)
	h := l.Hour()
	off := OffPeakDay(l)
	if plan == "ulo" {
		switch {
		case h >= 23 || h < 7:
			return "ultra_low"
		case off:
			return "weekend_off_peak"
		case h >= 16 && h < 21:
			return "on_peak"
		default:
			return "mid_peak"
		}
	}
	if off || h < 7 || h >= 19 {
		return "off_peak"
	}
	winter := l.Month() >= 11 || l.Month() <= 4
	if winter {
		if (h >= 7 && h < 11) || (h >= 17 && h < 19) {
			return "on_peak"
		}
		return "mid_peak"
	}
	if h >= 11 && h < 17 {
		return "on_peak"
	}
	return "mid_peak"
}

func OffPeakDay(t time.Time) bool {
	wd := t.Weekday()
	if wd == time.Saturday || wd == time.Sunday {
		return true
	}
	_, ok := holidays(t.Year())[date(t.Year(), t.Month(), t.Day())]
	return ok
}

func date(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }

func nthMonday(y int, m time.Month, n int) time.Time {
	d := date(y, m, 1)
	for d.Weekday() != time.Monday {
		d = d.AddDate(0, 0, 1)
	}
	return d.AddDate(0, 0, 7*(n-1))
}

func easter(y int) time.Time {
	a, b, c := y%19, y/100, y%100
	d, e := b/4, b%4
	f := (b + 8) / 25
	g := (b - f + 1) / 3
	h := (19*a + b - d - g + 15) % 30
	i, k := c/4, c%4
	l := (32 + 2*e + 2*i - h - k) % 7
	m := (a + 11*h + 22*l) / 451
	month := (h + l - 7*m + 114) / 31
	day := (h+l-7*m+114)%31 + 1
	return date(y, time.Month(month), day)
}

func holidays(y int) map[time.Time]struct{} {
	set := map[time.Time]struct{}{}
	add := func(t time.Time) { set[t] = struct{}{} }
	add(nthMonday(y, time.February, 3))
	add(easter(y).AddDate(0, 0, -2))
	v := date(y, time.May, 24)
	for v.Weekday() != time.Monday {
		v = v.AddDate(0, 0, -1)
	}
	add(v)
	add(nthMonday(y, time.August, 1))
	add(nthMonday(y, time.September, 1))
	add(nthMonday(y, time.October, 2))
	for _, d := range []time.Time{date(y, 1, 1), date(y, 7, 1), date(y, 12, 25), date(y, 12, 26)} {
		for {
			_, taken := set[d]
			if d.Weekday() != time.Saturday && d.Weekday() != time.Sunday && !taken {
				break
			}
			d = d.AddDate(0, 0, 1)
		}
		add(d)
	}
	return set
}
