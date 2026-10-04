// Package store writes readings and metrics to the telemetry database
// (TimescaleDB) in batches.
package store

import (
	"context"
	_ "embed"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed telemetry.sql
var schemaSQL string

// Migrate applies the telemetry schema. Idempotent.
func Migrate(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, schemaSQL)
	return err
}

type Reading struct {
	TS        time.Time
	DeviceID  string
	Channel   int16
	CurrentA  float32
	PowerW    float32
	EnergyKWh float64
}

type Metric struct {
	TS       time.Time
	DeviceID string
	Name     string
	Channel  int16
	Value    float64
}

// Writer buffers rows and flushes every FlushEvery or when MaxBatch rows are
// pending. Duplicate (device, channel, ts) rows — replays after an outage —
// are ignored by the primary key. If the database is down, rows are kept up
// to MaxPending and the oldest are dropped beyond that.
type Writer struct {
	DB         *pgxpool.Pool
	FlushEvery time.Duration
	MaxBatch   int
	MaxPending int
	Log        *slog.Logger

	mu       sync.Mutex
	readings []Reading
	metrics  []Metric
	kick     chan struct{}

	Written, Dropped, Failed int64
}

func NewWriter(db *pgxpool.Pool, log *slog.Logger) *Writer {
	return &Writer{DB: db, FlushEvery: time.Second, MaxBatch: 2000, MaxPending: 200_000, Log: log, kick: make(chan struct{}, 1)}
}

func (w *Writer) Add(r ...Reading) {
	w.mu.Lock()
	w.readings = append(w.readings, r...)
	if over := len(w.readings) - w.MaxPending; over > 0 {
		w.readings = w.readings[over:]
		w.Dropped += int64(over)
	}
	n := len(w.readings)
	w.mu.Unlock()
	if n >= w.MaxBatch {
		select {
		case w.kick <- struct{}{}:
		default:
		}
	}
}

func (w *Writer) AddMetric(m ...Metric) {
	w.mu.Lock()
	w.metrics = append(w.metrics, m...)
	w.mu.Unlock()
}

func (w *Writer) Pending() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return len(w.readings) + len(w.metrics)
}

func (w *Writer) Run(ctx context.Context) {
	t := time.NewTicker(w.FlushEvery)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			fctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			_ = w.Flush(fctx)
			cancel()
			return
		case <-t.C:
		case <-w.kick:
		}
		if err := w.Flush(ctx); err != nil && ctx.Err() == nil {
			w.Log.Warn("flush failed; will retry", "err", err, "pending", w.Pending())
		}
	}
}

// Flush writes everything pending. On failure the rows are put back.
func (w *Writer) Flush(ctx context.Context) error {
	w.mu.Lock()
	rs, ms := w.readings, w.metrics
	w.readings, w.metrics = nil, nil
	w.mu.Unlock()

	for len(rs) > 0 {
		n := min(len(rs), w.MaxBatch)
		if err := w.writeReadings(ctx, rs[:n]); err != nil {
			w.mu.Lock()
			w.readings = append(rs, w.readings...)
			w.metrics = append(ms, w.metrics...)
			w.Failed++
			w.mu.Unlock()
			return err
		}
		w.Written += int64(n)
		rs = rs[n:]
	}
	if len(ms) > 0 {
		if err := w.writeMetrics(ctx, ms); err != nil {
			w.mu.Lock()
			w.metrics = append(ms, w.metrics...)
			w.mu.Unlock()
			return err
		}
	}
	return nil
}

func (w *Writer) writeReadings(ctx context.Context, rs []Reading) error {
	ts := make([]time.Time, len(rs))
	dev := make([]string, len(rs))
	ch := make([]int16, len(rs))
	cur := make([]float32, len(rs))
	pow := make([]float32, len(rs))
	en := make([]float64, len(rs))
	for i, r := range rs {
		ts[i], dev[i], ch[i], cur[i], pow[i], en[i] = r.TS, r.DeviceID, r.Channel, r.CurrentA, r.PowerW, r.EnergyKWh
	}
	_, err := w.DB.Exec(ctx, `insert into readings (ts, device_id, channel, current_a, power_w, energy_kwh)
		select * from unnest($1::timestamptz[], $2::uuid[], $3::int2[], $4::real[], $5::real[], $6::float8[])
		on conflict do nothing`, ts, dev, ch, cur, pow, en)
	if err != nil {
		return fmt.Errorf("insert readings: %w", err)
	}
	return nil
}

func (w *Writer) writeMetrics(ctx context.Context, ms []Metric) error {
	ts := make([]time.Time, len(ms))
	dev := make([]string, len(ms))
	name := make([]string, len(ms))
	ch := make([]int16, len(ms))
	val := make([]float64, len(ms))
	for i, m := range ms {
		ts[i], dev[i], name[i], ch[i], val[i] = m.TS, m.DeviceID, m.Name, m.Channel, m.Value
	}
	_, err := w.DB.Exec(ctx, `insert into metrics (ts, device_id, name, channel, value)
		select * from unnest($1::timestamptz[], $2::uuid[], $3::text[], $4::int2[], $5::float8[])
		on conflict do nothing`, ts, dev, name, ch, val)
	return err
}
