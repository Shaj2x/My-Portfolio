package telemetry

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

var now = time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)

func msg(ts time.Time, channels string) []byte {
	return []byte(fmt.Sprintf(`{"ts":%d,"seq":1,"channels":[%s]}`, ts.UnixMilli(), channels))
}

func TestParseTopic(t *testing.T) {
	tp, err := ParseTopic("marq/dev/ct-laundry-01/telemetry")
	if err != nil || tp.HW != "ct-laundry-01" || tp.Kind != "telemetry" {
		t.Fatalf("got %+v %v", tp, err)
	}
	for _, bad := range []string{"marq/dev/CT/telemetry", "marq/dev/x/telemetry", "other/dev/ab/telemetry", "marq/dev/ab/nope", "marq/dev/ab"} {
		if _, err := ParseTopic(bad); err == nil {
			t.Errorf("%q should fail", bad)
		}
	}
}

func TestParseTelemetryValid(t *testing.T) {
	tel, warns, err := ParseTelemetry(msg(now, `{"ch":0,"current_a":4.8,"power_w":560,"energy_wh":12000},{"ch":1,"current_a":0.02}`), now)
	if err != nil || len(warns) != 0 || len(tel.Channels) != 2 {
		t.Fatalf("err=%v warns=%v ch=%d", err, warns, len(tel.Channels))
	}
	if !tel.Time().Equal(now) {
		t.Fatalf("time %v", tel.Time())
	}
}

func TestParseTelemetryRejects(t *testing.T) {
	cases := map[string][]byte{
		"not json":     []byte("{"),
		"no ts":        []byte(`{"channels":[{"ch":0,"current_a":1}]}`),
		"too old":      msg(now.Add(-25*time.Hour), `{"ch":0,"current_a":1}`),
		"future":       msg(now.Add(10*time.Minute), `{"ch":0,"current_a":1}`),
		"no channels":  msg(now, ``),
		"all invalid":  msg(now, `{"ch":0,"current_a":-1}`),
	}
	for name, b := range cases {
		if _, _, err := ParseTelemetry(b, now); err == nil {
			t.Errorf("%s: expected error", name)
		}
	}
}

func TestParseTelemetryDropsBadChannels(t *testing.T) {
	tel, warns, err := ParseTelemetry(msg(now, `{"ch":0,"current_a":5},{"ch":1,"current_a":500},{"ch":0,"current_a":1},{"ch":2,"power_w":-10},{"ch":3},{"ch":99,"current_a":1},{"ch":4,"power_w":90000}`), now)
	if err != nil {
		t.Fatal(err)
	}
	if len(tel.Channels) != 2 {
		t.Fatalf("kept %d channels: %+v", len(tel.Channels), tel.Channels)
	}
	if *tel.Channels[1].PowerW != 0 {
		t.Errorf("small negative power should clamp to 0, got %v", *tel.Channels[1].PowerW)
	}
	if len(warns) != 5 {
		t.Errorf("warnings: %v", warns)
	}
	if !strings.Contains(strings.Join(warns, ";"), "duplicate channel 0") {
		t.Errorf("missing duplicate warning: %v", warns)
	}
}

func TestReplayAccepted(t *testing.T) {
	if _, _, err := ParseTelemetry(msg(now.Add(-23*time.Hour), `{"ch":0,"current_a":1}`), now); err != nil {
		t.Fatalf("buffered reading from 23 h ago should be accepted: %v", err)
	}
}

func TestParseEvent(t *testing.T) {
	good := []string{
		`{"type":"motion","ch":0,"value":1}`,
		`{"type":"relay","state":"off","source":"failsafe"}`,
		`{"type":"soc","value":72.5}`,
	}
	for _, g := range good {
		if _, err := ParseEvent([]byte(g), now); err != nil {
			t.Errorf("%s: %v", g, err)
		}
	}
	bad := []string{`{"type":"relay","state":"maybe"}`, `{"type":"soc","value":120}`, `{"type":"laser"}`, `{"type":"motion","ch":40}`}
	for _, b := range bad {
		if _, err := ParseEvent([]byte(b), now); err == nil {
			t.Errorf("%s: expected error", b)
		}
	}
}

func TestParseStatus(t *testing.T) {
	s, err := ParseStatus([]byte(`{"state":"online","fw":"1.3.0","rssi":-61,"battery_pct":140}`))
	if err != nil || s.FW != "1.3.0" || *s.RSSI != -61 || s.BatteryPct != nil {
		t.Fatalf("%+v %v", s, err)
	}
	if _, err := ParseStatus([]byte(`{"state":"sleepy"}`)); err == nil {
		t.Fatal("bad state accepted")
	}
}
