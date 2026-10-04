// Marq Living node firmware — hardware-independent core.
//
// Everything here is plain C++17 with no Arduino dependency so it can be
// unit-tested on a laptop (test/host). src/main.cpp wires it to the ESP32:
// ADC sampling, Wi-Fi, MQTT, NVS, LittleFS, GPIO.
#pragma once

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>

namespace marq {

// ---------------------------------------------------------------------------
// CT clamp RMS current
// ---------------------------------------------------------------------------

// SCT-013 clamps come in current-output (-000, 100 A : 50 mA, needs a burden
// resistor) and voltage-output (-030 etc., 1 V at rated current) versions.
// Either way the ADC sees an AC voltage around a mid-rail bias.
struct CtConfig {
  float amps_per_volt = 30.0f;  // SCT-013-030: 30 A per 1 V RMS
  float noise_floor_a = 0.08f;  // readings below this are reported as 0
};

// RMS of the AC component. The DC bias (≈1.65 V) is removed with the sample
// mean, which is exact over whole mains cycles and robust to bias drift.
// `mv` are ADC readings in millivolts.
inline float rms_current(const uint16_t* mv, size_t n, const CtConfig& c) {
  if (n < 2) return 0.0f;
  double sum = 0;
  for (size_t i = 0; i < n; i++) sum += mv[i];
  const double mean = sum / n;
  double sq = 0;
  for (size_t i = 0; i < n; i++) {
    const double v = (mv[i] - mean) / 1000.0;
    sq += v * v;
  }
  const float vrms = static_cast<float>(std::sqrt(sq / n));
  const float amps = vrms * c.amps_per_volt;
  return amps < c.noise_floor_a ? 0.0f : amps;
}

// ---------------------------------------------------------------------------
// Energy counter (kept in NVS so it survives reboots)
// ---------------------------------------------------------------------------

struct EnergyCounter {
  double wh = 0;
  uint32_t last_ms = 0;
  float last_w = 0;
  bool started = false;

  // Trapezoidal integration. Gaps over 60 s (sleep, outage) aren't bridged:
  // guessing would make the counter wrong; the gap is visible in the data.
  void add(uint32_t now_ms, float watts) {
    if (started) {
      const uint32_t dt = now_ms - last_ms;  // wraps correctly on uint32 overflow
      if (dt > 0 && dt <= 60000) wh += (last_w + watts) / 2.0 * (dt / 3600000.0);
    }
    last_ms = now_ms;
    last_w = watts;
    started = true;
  }
};

// ---------------------------------------------------------------------------
// Offline buffer: fixed-capacity ring of serialized messages, oldest first.
// When full, the oldest is dropped (newest data matters most).
// ---------------------------------------------------------------------------

template <size_t Capacity, size_t MaxLen>
class RingBuffer {
 public:
  bool push(const char* msg) {
    const size_t len = std::strlen(msg);
    if (len >= MaxLen) return false;
    if (count_ == Capacity) {
      tail_ = (tail_ + 1) % Capacity;
      count_--;
      dropped_++;
    }
    std::memcpy(slots_[head_], msg, len + 1);
    head_ = (head_ + 1) % Capacity;
    count_++;
    return true;
  }
  const char* peek() const { return count_ ? slots_[tail_] : nullptr; }
  void pop() {
    if (!count_) return;
    tail_ = (tail_ + 1) % Capacity;
    count_--;
  }
  size_t size() const { return count_; }
  size_t dropped() const { return dropped_; }
  bool empty() const { return count_ == 0; }

 private:
  char slots_[Capacity][MaxLen];
  size_t head_ = 0, tail_ = 0, count_ = 0, dropped_ = 0;
};

// ---------------------------------------------------------------------------
// Room outputs with fail-safe and manual override
// ---------------------------------------------------------------------------

enum class Source { Command, Failsafe, Manual, Boot };

inline const char* source_name(Source s) {
  switch (s) {
    case Source::Command: return "command";
    case Source::Failsafe: return "failsafe";
    case Source::Manual: return "manual";
    default: return "boot";
  }
}

// Lights relay: wired so the DE-energized relay leaves lights ON (normally
// closed contact). HVAC relay: de-energized = thermostat in normal control;
// energized = setback. A dead node therefore fails safe without software.
struct Outputs {
  bool lights_on = true;
  bool hvac_normal = true;  // "comfort"/normal operation
  Source source = Source::Boot;

  bool lights_relay_energized() const { return !lights_on; }
  bool hvac_relay_energized() const { return !hvac_normal; }
};

struct Change {
  bool changed = false;
  int channel = -1;  // 0 lights, 1 hvac
  bool on = false;
  Source source = Source::Command;
};

class RoomController {
 public:
  static constexpr uint32_t kHeartbeatTimeoutMs = 120000;

  explicit RoomController(uint32_t boot_ms) : last_heartbeat_ms_(boot_ms), have_heartbeat_(false) {}

  const Outputs& outputs() const { return out_; }
  bool failsafe() const { return failsafe_; }
  bool manual() const { return manual_; }

  void heartbeat(uint32_t now_ms) {
    last_heartbeat_ms_ = now_ms;
    have_heartbeat_ = true;
    failsafe_ = false;
  }

  // Call every loop. Returns changes to report when fail-safe trips.
  int tick(uint32_t now_ms, Change out[2]) {
    if (failsafe_ || manual_) return 0;
    const bool stale = !have_heartbeat_ ? (now_ms - last_heartbeat_ms_ > kHeartbeatTimeoutMs)
                                        : (now_ms - last_heartbeat_ms_ > kHeartbeatTimeoutMs);
    if (!stale) return 0;
    failsafe_ = true;
    return set_all(true, true, Source::Failsafe, out);
  }

  // Connection to the broker lost: same as a missing heartbeat.
  int disconnected(Change out[2]) {
    if (failsafe_ || manual_) return 0;
    failsafe_ = true;
    return set_all(true, true, Source::Failsafe, out);
  }

  // Physical override switch. While held, commands are refused.
  int manual_switch(bool engaged, bool lights_on, Change out[2]) {
    manual_ = engaged;
    if (!engaged) return 0;
    return set_all(lights_on, true, Source::Manual, out);
  }

  // Apply a command. Returns false (with reason) if refused.
  bool command(int channel, bool on, Change* ch, const char** err) {
    if (manual_) {
      *err = "manual override active";
      return false;
    }
    if (failsafe_) {
      // A command proves the engine is alive again.
      failsafe_ = false;
    }
    if (channel != 0 && channel != 1) {
      *err = "unknown channel";
      return false;
    }
    bool& slot = channel == 0 ? out_.lights_on : out_.hvac_normal;
    ch->changed = slot != on;
    ch->channel = channel;
    ch->on = on;
    ch->source = Source::Command;
    slot = on;
    out_.source = Source::Command;
    *err = nullptr;
    return true;
  }

 private:
  int set_all(bool lights, bool hvac, Source src, Change out[2]) {
    int n = 0;
    if (out_.lights_on != lights) out[n++] = Change{true, 0, lights, src};
    if (out_.hvac_normal != hvac) out[n++] = Change{true, 1, hvac, src};
    out_.lights_on = lights;
    out_.hvac_normal = hvac;
    out_.source = src;
    return n;
  }

  Outputs out_;
  uint32_t last_heartbeat_ms_;
  bool have_heartbeat_;
  bool failsafe_ = false;
  bool manual_ = false;
};

// ---------------------------------------------------------------------------
// Motion: report at most once per hold-off period while motion continues.
// ---------------------------------------------------------------------------

struct MotionReporter {
  uint32_t holdoff_ms = 20000;
  uint32_t last_ms = 0;
  bool reported = false;

  bool should_report(uint32_t now_ms) {
    if (!reported || now_ms - last_ms >= holdoff_ms) {
      reported = true;
      last_ms = now_ms;
      return true;
    }
    return false;
  }
};

// ---------------------------------------------------------------------------
// Payloads (docs/mqtt-protocol.md). snprintf keeps this allocation-free.
// ---------------------------------------------------------------------------

struct ChannelReading {
  int ch;
  float current_a;
  float power_w;
  double energy_wh;
};

// Returns bytes written (excluding NUL) or -1 if the buffer is too small.
inline int telemetry_json(char* buf, size_t cap, uint64_t ts_ms, uint32_t seq, const ChannelReading* r, size_t n) {
  int w = std::snprintf(buf, cap, "{\"ts\":%llu,\"seq\":%lu,\"channels\":[", static_cast<unsigned long long>(ts_ms),
                        static_cast<unsigned long>(seq));
  if (w < 0 || static_cast<size_t>(w) >= cap) return -1;
  size_t off = w;
  for (size_t i = 0; i < n; i++) {
    w = std::snprintf(buf + off, cap - off, "%s{\"ch\":%d,\"current_a\":%.3f,\"power_w\":%.1f,\"energy_wh\":%.2f}", i ? "," : "",
                      r[i].ch, r[i].current_a, r[i].power_w, r[i].energy_wh);
    if (w < 0 || static_cast<size_t>(w) >= cap - off) return -1;
    off += w;
  }
  w = std::snprintf(buf + off, cap - off, "]}");
  if (w < 0 || static_cast<size_t>(w) >= cap - off) return -1;
  return static_cast<int>(off + w);
}

inline int relay_event_json(char* buf, size_t cap, uint64_t ts_ms, const Change& c) {
  return std::snprintf(buf, cap, "{\"ts\":%llu,\"type\":\"relay\",\"ch\":%d,\"state\":\"%s\",\"source\":\"%s\"}",
                       static_cast<unsigned long long>(ts_ms), c.channel, c.on ? "on" : "off", source_name(c.source));
}

inline int ack_json(char* buf, size_t cap, long long id, bool ok, const char* err) {
  if (ok || !err) return std::snprintf(buf, cap, "{\"id\":%lld,\"ok\":%s}", id, ok ? "true" : "false");
  return std::snprintf(buf, cap, "{\"id\":%lld,\"ok\":false,\"error\":\"%s\"}", id, err);
}

}  // namespace marq
