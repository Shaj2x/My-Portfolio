// Command automation runs the rules engine: bookings, occupancy, device
// events and the clock in; control commands (over MQTT, every one logged)
// and staff notifications out. It also publishes the fail-safe heartbeat
// and drives the web app's once-a-minute maintenance tick.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/jackc/pgx/v5/pgxpool"

	"marq-living/services/internal/automation"
	"marq-living/services/internal/mqttx"
	"marq-living/services/internal/notify"
	"marq-living/services/internal/registry"
	"marq-living/services/internal/telemetry"
)

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("automation stopped", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	app, err := pgxpool.New(ctx, env("SUPABASE_DB_URL", "postgres://postgres:postgres@localhost:54322/postgres"))
	if err != nil {
		return err
	}
	defer app.Close()
	tsdb, err := pgxpool.New(ctx, env("TIMESCALE_URL", "postgres://postgres:postgres@localhost:5433/telemetry"))
	if err != nil {
		return err
	}
	defer tsdb.Close()

	reg := registry.NewCache()
	for i := 0; ; i++ {
		if err = reg.Load(ctx, app); err == nil {
			break
		}
		if i > 30 {
			return err
		}
		log.Warn("load devices; retrying", "err", err)
		time.Sleep(2 * time.Second)
	}
	appURL := os.Getenv("APP_URL")
	poker := &notify.Poker{Log: log, Secret: os.Getenv("INTERNAL_API_SECRET")}
	if appURL != "" {
		poker.URL = appURL + "/api/internal/notify"
	}
	svc := automation.NewService(log, app, tsdb, reg, poker)
	svc.Plan = env("TARIFF_PLAN", "ulo")

	client, err := mqttx.Connect(mqttx.Options{
		URL:      env("MQTT_URL", "tcp://localhost:1883"),
		ClientID: env("MQTT_CLIENT_ID", "marq-automation"),
		Username: os.Getenv("MQTT_USERNAME"),
		Password: os.Getenv("MQTT_PASSWORD"),
		Subscriptions: map[string]mqtt.MessageHandler{
			"marq/dev/+/event":       func(_ mqtt.Client, m mqtt.Message) { svc.HandleDeviceEvent(m.Topic(), m.Payload()) },
			"marq/dev/+/ack":         func(_ mqtt.Client, m mqtt.Message) { svc.HandleAck(ctx, m.Payload()) },
			telemetry.SysEventsTopic: func(_ mqtt.Client, m mqtt.Message) { svc.HandleSysEvent(m.Payload()) },
		},
		Log: log,
	})
	if err != nil {
		return err
	}
	defer client.Disconnect(1000)
	svc.Pub = client

	every := func(d time.Duration, name string, f func() error) {
		go func() {
			t := time.NewTicker(d)
			defer t.Stop()
			for {
				if err := f(); err != nil && ctx.Err() == nil {
					log.Warn(name+" failed", "err", err)
				}
				select {
				case <-ctx.Done():
					return
				case <-t.C:
				}
			}
		}()
	}
	every(30*time.Second, "heartbeat", svc.Heartbeat)
	every(10*time.Second, "evaluate", func() error { return svc.Tick(ctx) })
	every(2*time.Second, "dispatch", func() error { return svc.Dispatch(ctx) })
	every(time.Minute, "reload devices", func() error { return reg.Load(ctx, app) })
	every(5*time.Minute, "booking energy", func() error { return svc.RecordBookingEnergy(ctx) })
	if appURL != "" && os.Getenv("CRON_SECRET") != "" {
		every(time.Minute, "app tick", func() error { return tick(ctx, appURL, os.Getenv("CRON_SECRET")) })
	}

	srv := &http.Server{Addr: env("HTTP_ADDR", ":8082"), ReadHeaderTimeout: 5 * time.Second}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		if !client.IsConnectionOpen() {
			http.Error(w, "mqtt disconnected", http.StatusServiceUnavailable)
			return
		}
		fmt.Fprintln(w, "ok")
	})
	go func() { _ = srv.ListenAndServe() }()
	log.Info("automation running")
	<-ctx.Done()
	shut, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return srv.Shutdown(shut)
}

// tick asks the web app to run maintenance and deliver notifications.
func tick(ctx context.Context, appURL, secret string) error {
	c, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(c, http.MethodGet, appURL+"/api/cron/tick", nil)
	req.Header.Set("Authorization", "Bearer "+secret)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("tick: %s", res.Status)
	}
	return nil
}
