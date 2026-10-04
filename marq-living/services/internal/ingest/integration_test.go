//go:build integration

// Integration test: embedded MQTT broker + real Postgres (app schema with all
// migrations, and the telemetry schema). Run via services/test-integration.sh.
package ingest

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/jackc/pgx/v5/pgxpool"
	mochi "github.com/mochi-mqtt/server/v2"
	"github.com/mochi-mqtt/server/v2/hooks/auth"
	"github.com/mochi-mqtt/server/v2/listeners"

	"marq-living/services/internal/appdb"
	"marq-living/services/internal/mqttx"
	"marq-living/services/internal/registry"
	"marq-living/services/internal/store"
	"marq-living/services/internal/telemetry"
)

const (
	laundryDev = "d1000000-0000-0000-0000-000000000001"
	lightsDev  = "d1000000-0000-0000-0000-000000000002"
	washer     = "e1000000-0000-0000-0000-000000000001"
	dryer      = "e1000000-0000-0000-0000-000000000002"
	tenant     = "a9000000-0000-0000-0000-000000000009"
)

type clock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *clock) Now() time.Time      { c.mu.Lock(); defer c.mu.Unlock(); return c.t }
func (c *clock) Set(t time.Time)     { c.mu.Lock(); c.t = t; c.mu.Unlock() }

func TestIngestPipeline(t *testing.T) {
	ctx := context.Background()
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))
	app := mustPool(t, os.Getenv("APP_DB_URL"))
	tsdb := mustPool(t, os.Getenv("TSDB_URL"))
	if err := store.Migrate(ctx, tsdb); err != nil {
		t.Fatal(err)
	}
	if err := store.Migrate(ctx, tsdb); err != nil {
		t.Fatalf("migrate must be idempotent: %v", err)
	}
	exec(t, app, `
		insert into auth.users (id, email, raw_user_meta_data) values ('`+tenant+`', 'w@marq.test', '{"full_name":"W","unit":"808","room_letter":"A","floor":"8"}');
		update public.profiles set status = 'approved' where id = '`+tenant+`';
		insert into public.devices (id, hardware_id, name, type, location, config) values
		  ('`+laundryDev+`', 'ct-laundry-it', 'Laundry CT', 'ct_node', 'Laundry room', '{}'),
		  ('`+lightsDev+`', 'ct-lobby-it', 'Lobby CT', 'ct_node', 'Lobby',
		   '{"channels":{"0":{"label":"Lights","after_hours_max_w":50,"expected_hours":{"from":"08:00","to":"23:00"}}}}');
		insert into public.laundry_machines (id, label, kind, device_id, channel, state) values
		  ('`+washer+`', 'Washer 7', 'washer', '`+laundryDev+`', 0, 'idle'),
		  ('`+dryer+`', 'Dryer 7', 'dryer', '`+laundryDev+`', 1, 'idle');
		insert into public.laundry_watchers (user_id, kind) values ('`+tenant+`', 'washer');`)

	// Embedded broker.
	srv := mochi.New(nil)
	_ = srv.AddHook(new(auth.AllowHook), nil)
	tcp := listeners.NewTCP(listeners.Config{ID: "t1", Address: "127.0.0.1:18831"})
	if err := srv.AddListener(tcp); err != nil {
		t.Fatal(err)
	}
	go srv.Serve()
	defer srv.Close()

	reg := registry.NewCache()
	if err := reg.Load(ctx, app); err != nil {
		t.Fatal(err)
	}
	w := store.NewWriter(tsdb, log)
	adb := appdb.New(app)
	clk := &clock{t: time.Now().UTC().Truncate(time.Second)}
	proc := New(log, reg, w, adb, tsdb, nil, nil)
	proc.Now = clk.Now
	if err := proc.LoadMachines(ctx); err != nil {
		t.Fatal(err)
	}

	var sysMu sync.Mutex
	var sys []telemetry.SysEvent
	done := make(chan struct{}, 1000)
	handler := func(_ mqtt.Client, m mqtt.Message) {
		proc.Handle(ctx, m.Topic(), m.Payload())
		done <- struct{}{}
	}
	c, err := mqttx.Connect(mqttx.Options{URL: "tcp://127.0.0.1:18831", ClientID: "ingest-it", Log: log,
		Subscriptions: map[string]mqtt.MessageHandler{"marq/dev/+/telemetry": handler, "marq/dev/+/status": handler, "marq/dev/+/event": handler,
			telemetry.SysEventsTopic: func(_ mqtt.Client, m mqtt.Message) {
				var e telemetry.SysEvent
				_ = json.Unmarshal(m.Payload(), &e)
				sysMu.Lock()
				sys = append(sys, e)
				sysMu.Unlock()
			}}})
	if err != nil {
		t.Fatal(err)
	}
	defer c.Disconnect(100)
	proc.Pub = c
	dev, err := mqttx.Connect(mqttx.Options{URL: "tcp://127.0.0.1:18831", ClientID: "device-it", Log: log})
	if err != nil {
		t.Fatal(err)
	}

	send := func(hw, kind string, body string) {
		if err := dev.PublishJSON(telemetry.DeviceTopic(hw, kind), false, []byte(body)); err != nil {
			t.Fatal(err)
		}
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Fatalf("message on %s/%s not processed", hw, kind)
		}
	}
	tel := func(hw string, at time.Time, ch0, ch1 float64) string {
		return fmt.Sprintf(`{"ts":%d,"seq":1,"channels":[{"ch":0,"current_a":%.3f,"power_w":%.1f},{"ch":1,"current_a":%.3f,"power_w":%.1f}]}`,
			at.UnixMilli(), ch0/120, ch0, ch1/120, ch1)
	}

	// --- Washer cycle (sim time) with dryer heater failure alongside -------
	start := clk.Now()
	profile := []struct {
		min    float64
		washer float64
		dryer  float64
	}{{1, 3, 5}, {5, 60, 300}, {15, 350, 300}, {8, 200, 5}, {6, 520, 5}, {4, 2, 5}}
	at := start
	for _, s := range profile {
		end := at.Add(time.Duration(s.min * float64(time.Minute)))
		for ; at.Before(end); at = at.Add(15 * time.Second) {
			clk.Set(at)
			send("ct-laundry-it", "telemetry", tel("ct-laundry-it", at, s.washer, s.dryer))
		}
	}
	if err := w.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	var n int
	scan(t, tsdb, `select count(*) from readings where device_id = '`+laundryDev+`'`, &n)
	stored := n
	if n == 0 {
		t.Fatal("no readings stored")
	}
	t.Logf("%d readings stored", n)

	var state string
	scan(t, app, `select state::text from public.laundry_machines where id = '`+washer+`'`, &state)
	if state != "idle" {
		t.Fatalf("washer should be idle after the cycle, is %s", state)
	}
	var transitions string
	scan(t, app, `select string_agg(payload->>'to', ',' order by id) from public.device_events where type = 'state_change' and payload->>'machine_id' = '`+washer+`'`, &transitions)
	if transitions != "running,finishing,idle" {
		t.Fatalf("washer transitions %q", transitions)
	}
	scan(t, app, `select count(*) from public.notifications where user_id = '`+tenant+`' and kind = 'laundry_free'`, &n)
	if n != 1 {
		t.Fatalf("watcher notified %d times", n)
	}
	scan(t, app, `select count(*) from public.laundry_watchers`, &n)
	if n != 0 {
		t.Fatal("watch should be one-shot")
	}

	// Dryer tumbled without heat for > 12 min → fault → ticket + announcement.
	scan(t, app, `select state::text from public.laundry_machines where id = '`+dryer+`'`, &state)
	if state != "fault" {
		t.Fatalf("dryer should be faulted, is %s", state)
	}
	scan(t, app, `select count(*) from public.tickets where device_id = '`+laundryDev+`' and source = 'system'`, &n)
	if n != 1 {
		t.Fatalf("system tickets: %d", n)
	}
	scan(t, app, `select count(*) from public.announcements where title = 'Dryer 7 is out of service'`, &n)
	if n != 1 {
		t.Fatalf("announcements: %d", n)
	}

	// --- Energy integrates when the node doesn't send a counter ------------
	var kwh float64
	scan(t, tsdb, `select max(energy_kwh) from readings where device_id = '`+laundryDev+`' and channel = 0`, &kwh)
	// 5 min×60 W + 15×350 + 8×200 + 6×520 ≈ 0.171 kWh
	if kwh < 0.15 || kwh > 0.19 {
		t.Fatalf("integrated energy %.3f kWh", kwh)
	}

	// --- Replay after an outage is deduplicated ------------------------------
	old := tel("ct-laundry-it", start.Add(30*time.Second), 3, 5)
	send("ct-laundry-it", "telemetry", old)
	send("ct-laundry-it", "telemetry", old)
	_ = w.Flush(ctx)
	var after int
	scan(t, tsdb, `select count(*) from readings where device_id = '`+laundryDev+`'`, &after)
	if after != stored {
		t.Fatalf("replayed readings should be deduplicated: %d → %d", stored, after)
	}

	// --- Unknown devices and bad payloads are rejected ----------------------
	before := proc.Stats.UnknownDevice.Load()
	send("ct-stranger", "telemetry", tel("ct-stranger", clk.Now(), 1, 1))
	if proc.Stats.UnknownDevice.Load() != before+1 {
		t.Fatal("unregistered device accepted")
	}
	rej := proc.Stats.Rejected.Load()
	send("ct-laundry-it", "telemetry", `{"ts":1,"channels":[]}`)
	if proc.Stats.Rejected.Load() != rej+1 {
		t.Fatal("bad payload accepted")
	}

	// --- Lights left on overnight → anomaly → ticket -------------------------
	loc, _ := time.LoadLocation("America/Toronto")
	night := time.Date(at.In(loc).Year(), at.In(loc).Month(), at.In(loc).Day(), 23, 30, 0, 0, loc)
	if night.After(time.Now().Add(time.Minute)) {
		night = night.Add(-24 * time.Hour)
	}
	for m := night; m.Before(night.Add(17 * time.Minute)); m = m.Add(30 * time.Second) {
		clk.Set(m)
		send("ct-lobby-it", "telemetry", tel("ct-lobby-it", m, 400, 0))
	}
	scan(t, app, `select count(*) from public.device_events where device_id = '`+lightsDev+`' and type = 'anomaly'`, &n)
	if n != 1 {
		t.Fatalf("anomaly events: %d", n)
	}

	// --- Presence: last will → offline; data → online; firmware recorded ----
	clk.Set(time.Now())
	send("ct-lobby-it", "status", `{"state":"offline"}`)
	scan(t, app, `select status::text from public.devices where id = '`+lightsDev+`'`, &state)
	if state != "offline" {
		t.Fatalf("lobby node should be offline, is %s", state)
	}
	send("ct-lobby-it", "status", `{"state":"online","fw":"1.3.0","rssi":-58}`)
	if err := adb.FlushPresence(ctx); err != nil {
		t.Fatal(err)
	}
	var fw string
	scan(t, app, `select status::text || '/' || coalesce(firmware_version, '') from public.devices where id = '`+lightsDev+`'`, &fw)
	if fw != "online/1.3.0" {
		t.Fatalf("presence: %s", fw)
	}

	// Silence → offline sweep (5 min after the laundry node's last reading).
	clk.Set(at.Add(5 * time.Minute))
	proc.Sweep(ctx)
	scan(t, app, `select count(*) from public.device_events where device_id = '`+laundryDev+`' and type = 'offline'`, &n)
	if n != 1 {
		t.Fatalf("silent device offline events: %d", n)
	}

	// --- Motion and SoC go to the metrics table -------------------------------
	clk.Set(time.Now())
	send("ct-lobby-it", "event", fmt.Sprintf(`{"ts":%d,"type":"motion","ch":0}`, time.Now().UnixMilli()))
	send("ct-lobby-it", "event", fmt.Sprintf(`{"ts":%d,"type":"soc","value":81.5}`, time.Now().UnixMilli()))
	_ = w.Flush(ctx)
	scan(t, tsdb, `select count(*) from metrics where device_id = '`+lightsDev+`'`, &n)
	if n != 2 {
		t.Fatalf("metrics rows: %d", n)
	}

	time.Sleep(300 * time.Millisecond)
	sysMu.Lock()
	kinds := map[string]int{}
	for _, e := range sys {
		kinds[e.Kind]++
	}
	sysMu.Unlock()
	if kinds["machine_state"] < 3 || kinds["fault"] < 1 || kinds["anomaly"] < 1 {
		t.Fatalf("sys events published: %v", kinds)
	}
}

func mustPool(t *testing.T, url string) *pgxpool.Pool {
	if url == "" {
		t.Skip("APP_DB_URL / TSDB_URL not set; run services/test-integration.sh")
	}
	p, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(p.Close)
	return p
}

func exec(t *testing.T, db *pgxpool.Pool, sql string) {
	if _, err := db.Exec(context.Background(), sql); err != nil {
		t.Fatal(err)
	}
}

func scan(t *testing.T, db *pgxpool.Pool, sql string, dst any) {
	if err := db.QueryRow(context.Background(), sql).Scan(dst); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
}
