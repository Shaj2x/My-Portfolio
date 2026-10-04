// Package notify pokes the web app to deliver notifications the database
// just queued (push/email), debounced so a burst of events makes one call.
package notify

import (
	"context"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

type Poker struct {
	URL    string // https://app/api/internal/notify
	Secret string
	Log    *slog.Logger
	Delay  time.Duration

	mu    sync.Mutex
	timer *time.Timer
}

func (p *Poker) Kick() {
	if p == nil || p.URL == "" {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.timer != nil {
		return
	}
	d := p.Delay
	if d == 0 {
		d = 2 * time.Second
	}
	p.timer = time.AfterFunc(d, func() {
		p.mu.Lock()
		p.timer = nil
		p.mu.Unlock()
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, p.URL, nil)
		req.Header.Set("Authorization", "Bearer "+p.Secret)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			p.Log.Warn("notify poke failed", "err", err)
			return
		}
		res.Body.Close()
		if res.StatusCode >= 300 {
			p.Log.Warn("notify poke rejected", "status", res.StatusCode)
		}
	})
}
