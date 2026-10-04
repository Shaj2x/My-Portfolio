// Package registry caches the device registry (Supabase public.devices) and
// applies per-channel calibration.
package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ChannelCal struct {
	CurrentScale   float64 `json:"current_scale"`
	CurrentOffsetA float64 `json:"current_offset_a"`
	Voltage        float64 `json:"voltage"`
	PowerFactor    float64 `json:"power_factor"`
}

type Calibration struct {
	Channels map[string]ChannelCal `json:"channels"`
}

// Hours is a daily window in building local time, "HH:MM"–"HH:MM". A window
// that ends before it starts wraps past midnight.
type Hours struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type ChannelConfig struct {
	Label string `json:"label"`
	// Above this for 30 s is a fault (e.g. a stalled motor).
	MaxW float64 `json:"max_w"`
	// Outside ExpectedHours, drawing more than this for 15 min is an anomaly
	// (lights left on overnight).
	AfterHoursMaxW float64 `json:"after_hours_max_w"`
	ExpectedHours  *Hours  `json:"expected_hours"`
}

type Config struct {
	IntervalS int                      `json:"interval_s"`
	Channels  map[string]ChannelConfig `json:"channels"`
	// Room-level mapping for PIR/relay nodes, e.g. {"lights": 0, "hvac": 1}.
	Outputs map[string]int `json:"outputs"`
}

type Device struct {
	ID          string
	HW          string
	Name        string
	Type        string
	Location    string
	RoomID      string
	Status      string
	Simulated   bool
	Calibration Calibration
	Config      Config
}

func (d Device) Interval() time.Duration {
	if d.Config.IntervalS > 0 {
		return time.Duration(d.Config.IntervalS) * time.Second
	}
	return 5 * time.Second
}

func (d Device) Channel(ch int) ChannelConfig { return d.Config.Channels[strconv.Itoa(ch)] }

// Calibrate turns a raw reading into calibrated current and power. Power is
// taken from the device when it reports it (it may have a voltage sensor);
// otherwise it's estimated from current × nominal voltage × power factor.
func (d Device) Calibrate(ch int, currentA, powerW *float64) (float64, float64) {
	cal, ok := d.Calibration.Channels[strconv.Itoa(ch)]
	if !ok {
		cal = ChannelCal{}
	}
	scale := cal.CurrentScale
	if scale == 0 {
		scale = 1
	}
	volts := cal.Voltage
	if volts == 0 {
		volts = 120
	}
	pf := cal.PowerFactor
	if pf == 0 {
		pf = 1
	}
	var i float64
	if currentA != nil {
		i = (*currentA - cal.CurrentOffsetA) * scale
		if i < 0 {
			i = 0
		}
	}
	var p float64
	if powerW != nil {
		p = *powerW * scale
	} else {
		p = i * volts * pf
	}
	if currentA == nil && volts > 0 && pf > 0 {
		i = p / (volts * pf)
	}
	return i, p
}

// Cache holds devices by hardware ID; Load replaces the snapshot atomically.
type Cache struct {
	mu   sync.RWMutex
	byHW map[string]Device
	byID map[string]Device
}

func NewCache(devs ...Device) *Cache {
	c := &Cache{}
	c.Set(devs)
	return c
}

func (c *Cache) Set(devs []Device) {
	byHW := make(map[string]Device, len(devs))
	byID := make(map[string]Device, len(devs))
	for _, d := range devs {
		byHW[d.HW] = d
		byID[d.ID] = d
	}
	c.mu.Lock()
	c.byHW, c.byID = byHW, byID
	c.mu.Unlock()
}

func (c *Cache) ByHW(hw string) (Device, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	d, ok := c.byHW[hw]
	return d, ok
}

func (c *Cache) ByID(id string) (Device, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	d, ok := c.byID[id]
	return d, ok
}

func (c *Cache) All() []Device {
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make([]Device, 0, len(c.byID))
	for _, d := range c.byID {
		out = append(out, d)
	}
	return out
}

func (c *Cache) Load(ctx context.Context, db *pgxpool.Pool) error {
	rows, err := db.Query(ctx, `select id::text, hardware_id, name, type::text, location, coalesce(room_id::text, ''),
		status::text, simulated, calibration, config from public.devices where status <> 'retired'`)
	if err != nil {
		return fmt.Errorf("load devices: %w", err)
	}
	defer rows.Close()
	var devs []Device
	for rows.Next() {
		var d Device
		var cal, cfg []byte
		if err := rows.Scan(&d.ID, &d.HW, &d.Name, &d.Type, &d.Location, &d.RoomID, &d.Status, &d.Simulated, &cal, &cfg); err != nil {
			return err
		}
		_ = json.Unmarshal(cal, &d.Calibration)
		_ = json.Unmarshal(cfg, &d.Config)
		devs = append(devs, d)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	c.Set(devs)
	return nil
}

// InWindow reports whether local clock time t falls inside h.
func InWindow(h *Hours, t time.Time) bool {
	if h == nil {
		return true
	}
	from, ok1 := minutes(h.From)
	to, ok2 := minutes(h.To)
	if !ok1 || !ok2 {
		return true
	}
	m := t.Hour()*60 + t.Minute()
	if from <= to {
		return m >= from && m < to
	}
	return m >= from || m < to
}

func minutes(s string) (int, bool) {
	parts := strings.Split(s, ":")
	if len(parts) < 2 {
		return 0, false
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil || h < 0 || h > 24 || m < 0 || m > 59 {
		return 0, false
	}
	return h*60 + m, true
}
