// Package mqttx wraps the Paho client with the options every Marq service
// uses: auto-reconnect, resubscribe on reconnect, and a Last Will.
package mqttx

import (
	"fmt"
	"log/slog"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

type Options struct {
	URL      string // tcp://host:1883 or ssl://host:8883
	ClientID string
	Username string
	Password string
	// Topic → handler, (re)subscribed on every connect.
	Subscriptions map[string]mqtt.MessageHandler
	Will          *Will
	Log           *slog.Logger
}

type Will struct {
	Topic    string
	Payload  string
	Retained bool
}

type Client struct{ mqtt.Client }

func Connect(o Options) (*Client, error) {
	opts := mqtt.NewClientOptions().
		AddBroker(o.URL).
		SetClientID(o.ClientID).
		SetUsername(o.Username).
		SetPassword(o.Password).
		SetAutoReconnect(true).
		SetConnectRetry(true).
		SetConnectRetryInterval(2 * time.Second).
		SetMaxReconnectInterval(30 * time.Second).
		SetKeepAlive(30 * time.Second).
		SetCleanSession(false).
		SetOrderMatters(false)
	if o.Will != nil {
		opts.SetWill(o.Will.Topic, o.Will.Payload, 1, o.Will.Retained)
	}
	// Connect returns only once the first round of subscriptions is
	// confirmed, so no message published after startup can be missed.
	ready := make(chan struct{})
	var once sync.Once
	opts.SetOnConnectHandler(func(c mqtt.Client) {
		for topic, h := range o.Subscriptions {
			tok := c.Subscribe(topic, 1, h)
			if !tok.WaitTimeout(10 * time.Second) {
				o.Log.Error("subscribe timed out", "topic", topic)
			} else if tok.Error() != nil {
				o.Log.Error("subscribe failed", "topic", topic, "err", tok.Error())
			}
		}
		o.Log.Info("mqtt connected", "broker", o.URL, "subscriptions", len(o.Subscriptions))
		once.Do(func() { close(ready) })
	})
	opts.SetConnectionLostHandler(func(_ mqtt.Client, err error) {
		o.Log.Warn("mqtt connection lost", "err", err)
	})
	c := mqtt.NewClient(opts)
	tok := c.Connect()
	if !tok.WaitTimeout(15 * time.Second) {
		return nil, fmt.Errorf("mqtt connect to %s timed out", o.URL)
	}
	if err := tok.Error(); err != nil {
		return nil, err
	}
	select {
	case <-ready:
	case <-time.After(20 * time.Second):
		return nil, fmt.Errorf("mqtt subscriptions on %s not confirmed", o.URL)
	}
	return &Client{c}, nil
}

func (c *Client) PublishJSON(topic string, retained bool, payload []byte) error {
	tok := c.Publish(topic, 1, retained, payload)
	if !tok.WaitTimeout(10 * time.Second) {
		return fmt.Errorf("publish %s timed out", topic)
	}
	return tok.Error()
}
