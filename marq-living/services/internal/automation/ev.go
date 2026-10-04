package automation

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"
)

// planSlot is one interval of an EV session plan (written by analytics).
type planSlot struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
	KW    float64   `json:"kw"`
}

type evSession struct {
	id, chargerDev, hw, status string
	tenant                     *string
	label                      string
	requested, delivered       float64
	started                    *time.Time
	created, departure         time.Time
	slots                      []planSlot
	maxKW                      float64
}

// PlannedKW is the plan's charging power at t (0 outside any slot).
func PlannedKW(slots []planSlot, t time.Time) float64 {
	for _, s := range slots {
		if !t.Before(s.Start) && t.Before(s.End) {
			return s.KW
		}
	}
	return 0
}

// ScaleToHeadroom shrinks the planned EV powers proportionally so the sum
// fits under the available headroom (live non-EV load vs the peak limit).
func ScaleToHeadroom(planned map[string]float64, headroom float64) map[string]float64 {
	total := 0.0
	for _, v := range planned {
		total += v
	}
	if total <= headroom || total == 0 {
		return planned
	}
	f := math.Max(headroom, 0) / total
	out := make(map[string]float64, len(planned))
	for k, v := range planned {
		out[k] = math.Floor(v*f*10+1e-9) / 10
	}
	return out
}

// ApplyEV runs every minute: follow each session's plan, keep live demand
// under the peak limit, track delivered energy, and finish sessions.
func (s *Service) ApplyEV(ctx context.Context) error {
	now := s.Now()
	rows, err := s.App.Query(ctx, `select es.id::text, d.id::text, d.hardware_id, es.status::text, es.tenant_id::text,
		coalesce(es.vehicle_label, ''), es.requested_kwh::float8, es.delivered_kwh::float8, es.started_at, es.created_at,
		es.departure_time, coalesce(es.plan->'slots', '[]'::jsonb), ch.max_kw::float8
		from public.ev_sessions es join public.ev_chargers ch on ch.id = es.charger_id join public.devices d on d.id = ch.device_id
		where es.status in ('scheduled', 'charging', 'paused')`)
	if err != nil {
		return err
	}
	var sessions []*evSession
	for rows.Next() {
		var e evSession
		var slots []byte
		if err := rows.Scan(&e.id, &e.chargerDev, &e.hw, &e.status, &e.tenant, &e.label, &e.requested, &e.delivered, &e.started,
			&e.created, &e.departure, &slots, &e.maxKW); err != nil {
			rows.Close()
			return err
		}
		_ = json.Unmarshal(slots, &e.slots)
		sessions = append(sessions, &e)
	}
	rows.Close()

	// Live load and peak limit.
	var limit float64
	_ = s.App.QueryRow(ctx, `select coalesce(max(peak_limit_kw), 150)::float8 from public.energy_sources where kind = 'grid' and enabled`).Scan(&limit)
	var evDevs []string
	evRows, _ := s.App.Query(ctx, `select device_id::text from public.ev_chargers where device_id is not null`)
	for evRows.Next() {
		var id string
		_ = evRows.Scan(&id)
		evDevs = append(evDevs, id)
	}
	evRows.Close()
	var nonEV float64
	_ = s.TSDB.QueryRow(ctx, `select coalesce(sum(power_w) filter (where not (device_id = any($1::uuid[]))), 0) / 1000
		from readings_latest where ts > now() - interval '2 minutes'`, evDevs).Scan(&nonEV)

	planned := map[string]float64{}
	for _, e := range sessions {
		// Delivered energy from the charger's meter since the session started.
		since := e.created
		if e.started != nil {
			since = *e.started
		}
		var kwh float64
		_ = s.TSDB.QueryRow(ctx, `select coalesce(max(energy_kwh) - min(energy_kwh), 0) from readings where device_id = $1 and ts >= $2`, e.chargerDev, since).Scan(&kwh)
		if kwh > e.delivered {
			e.delivered = kwh
			_, _ = s.App.Exec(ctx, `update public.ev_sessions set delivered_kwh = $2 where id = $1`, e.id, math.Round(kwh*1000)/1000)
		}
		if e.delivered >= e.requested-0.05 || !now.Before(e.departure) {
			_, _ = s.App.Exec(ctx, `update public.ev_sessions set status = 'completed', ended_at = now() where id = $1`, e.id)
			if e.tenant != nil {
				_, _ = s.App.Exec(ctx, `select public.notify_users(array[$1::uuid], 'ev_update', 'Charging complete', $2, '/ev', false, true, false, '{}'::jsonb)`,
					*e.tenant, fmt.Sprintf("%.1f kWh delivered.", e.delivered))
				s.Notifier.Kick()
			}
			planned[e.hw] = 0
			continue
		}
		planned[e.hw] = math.Min(PlannedKW(e.slots, now), e.maxKW)
	}
	allowed := ScaleToHeadroom(planned, limit-nonEV)

	s.mu.Lock()
	if s.evSent == nil {
		s.evSent = map[string]float64{}
	}
	s.mu.Unlock()
	for _, e := range sessions {
		kw, ok := allowed[e.hw]
		if !ok {
			continue
		}
		s.mu.Lock()
		last, sent := s.evSent[e.hw]
		s.mu.Unlock()
		if sent && math.Abs(last-kw) < 0.1 {
			continue
		}
		reason := fmt.Sprintf("EV schedule: %.1f kW", kw)
		if kw < planned[e.hw]-0.05 {
			reason = fmt.Sprintf("Peak guard: %.1f of %.1f kW planned (building at %.0f of %.0f kW)", kw, planned[e.hw], nonEV, limit)
		}
		body, _ := json.Marshal(map[string]any{"ev": map[string]float64{"limit_kw": kw}})
		if _, err := s.App.Exec(ctx, `insert into public.control_commands (device_id, command, source, reason) values ($1, $2, 'scheduler', $3)`,
			e.chargerDev, body, reason); err != nil {
			return err
		}
		s.mu.Lock()
		s.evSent[e.hw] = kw
		s.mu.Unlock()
		switch {
		case kw > 0 && e.status != "charging":
			_, _ = s.App.Exec(ctx, `update public.ev_sessions set status = 'charging', started_at = coalesce(started_at, now()) where id = $1 and status in ('scheduled','paused')`, e.id)
		case kw == 0 && e.status == "charging":
			_, _ = s.App.Exec(ctx, `update public.ev_sessions set status = 'paused' where id = $1 and status = 'charging'`, e.id)
		}
	}
	return nil
}
