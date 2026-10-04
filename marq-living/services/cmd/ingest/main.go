// Command ingest subscribes to device topics on the MQTT broker, validates
// and batches readings into TimescaleDB, and records device presence,
// laundry availability and device events in the app database.
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

	"marq-living/services/internal/appdb"
	"marq-living/services/internal/ingest"
	"marq-living/services/internal/mqttx"
	"marq-living/services/internal/notify"
	"marq-living/services/internal/registry"
	"marq-living/services/internal/store"
)

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	if err := run(log); err != nil {
		log.Error("ingest stopped", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	tsdb, err := pgxpool.New(ctx, env("TIMESCALE_URL", "postgres://postgres:postgres@localhost:5433/telemetry"))
	if err != nil {
		return err
	}
	defer tsdb.Close()
	appPool, err := pgxpool.New(ctx, env("SUPABASE_DB_URL", "postgres://postgres:postgres@localhost:54322/postgres"))
	if err != nil {
		return err
	}
	defer appPool.Close()

	if err := retry(ctx, log, "migrate telemetry db", func() error { return store.Migrate(ctx, tsdb) }); err != nil {
		return err
	}
	reg := registry.NewCache()
	if err := retry(ctx, log, "load devices", func() error { return reg.Load(ctx, appPool) }); err != nil {
		return err
	}

	writer := store.NewWriter(tsdb, log)
	app := appdb.New(appPool)
	poker := &notify.Poker{URL: os.Getenv("APP_NOTIFY_URL"), Secret: os.Getenv("INTERNAL_API_SECRET"), Log: log}
	proc := ingest.New(log, reg, writer, app, tsdb, nil, poker)
	if err := proc.LoadMachines(ctx); err != nil {
		return fmt.Errorf("load laundry machines: %w", err)
	}

	msgs := make(chan mqtt.Message, 10_000)
	handler := func(_ mqtt.Client, m mqtt.Message) {
		select {
		case msgs <- m:
		default:
			proc.Stats.Rejected.Add(1) // back-pressure: drop rather than block the client
		}
	}
	client, err := mqttx.Connect(mqttx.Options{
		URL:      env("MQTT_URL", "tcp://localhost:1883"),
		ClientID: env("MQTT_CLIENT_ID", "marq-ingest"),
		Username: os.Getenv("MQTT_USERNAME"),
		Password: os.Getenv("MQTT_PASSWORD"),
		Subscriptions: map[string]mqtt.MessageHandler{
			"marq/dev/+/telemetry": handler,
			"marq/dev/+/status":    handler,
			"marq/dev/+/event":     handler,
		},
		Log: log,
	})
	if err != nil {
		return err
	}
	defer client.Disconnect(1000)
	proc.Pub = client

	go writer.Run(ctx)
	// One worker keeps each device's messages in order (the laundry state
	// machines and energy integration depend on it). Writes are batched, so
	// a single worker handles thousands of messages a second.
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case m := <-msgs:
				proc.Handle(ctx, m.Topic(), m.Payload())
			}
		}
	}()

	go every(ctx, 15*time.Second, func() {
		proc.Sweep(ctx)
		if err := app.FlushPresence(ctx); err != nil {
			log.Warn("presence flush", "err", err)
		}
	})
	go every(ctx, time.Minute, func() {
		if err := reg.Load(ctx, appPool); err != nil {
			log.Warn("reload devices", "err", err)
		}
		if err := proc.LoadMachines(ctx); err != nil {
			log.Warn("reload machines", "err", err)
		}
	})

	srv := &http.Server{Addr: env("HTTP_ADDR", ":8081"), ReadHeaderTimeout: 5 * time.Second}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		if !client.IsConnectionOpen() {
			http.Error(w, "mqtt disconnected", http.StatusServiceUnavailable)
			return
		}
		fmt.Fprintln(w, "ok")
	})
	http.HandleFunc("/metrics", func(w http.ResponseWriter, _ *http.Request) {
		s := &proc.Stats
		fmt.Fprintf(w, "marq_ingest_messages_total %d\nmarq_ingest_rejected_total %d\nmarq_ingest_unknown_device_total %d\nmarq_ingest_readings_total %d\nmarq_ingest_events_total %d\nmarq_ingest_written_total %d\nmarq_ingest_pending %d\nmarq_ingest_dropped_total %d\n",
			s.Messages.Load(), s.Rejected.Load(), s.UnknownDevice.Load(), s.Readings.Load(), s.Events.Load(), writer.Written, writer.Pending(), writer.Dropped)
	})
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("http", "err", err)
		}
	}()
	log.Info("ingest running")
	<-ctx.Done()
	shut, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shut)
	_ = app.FlushPresence(shut)
	return nil
}

func every(ctx context.Context, d time.Duration, f func()) {
	t := time.NewTicker(d)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			f()
		}
	}
}

func retry(ctx context.Context, log *slog.Logger, what string, f func() error) error {
	var err error
	for i := 0; i < 30; i++ {
		if err = f(); err == nil {
			return nil
		}
		log.Warn(what+" failed; retrying", "err", err)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
	return fmt.Errorf("%s: %w", what, err)
}
