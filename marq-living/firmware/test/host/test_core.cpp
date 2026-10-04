// Host unit tests for lib/marq_core. Run: make -C test/host
#include <cassert>
#include <cmath>
#include <cstdio>
#include <vector>

#include "../../lib/marq_core/marq_core.h"

using namespace marq;

static int passed = 0;
#define CHECK(cond)                                                       \
  do {                                                                    \
    if (!(cond)) {                                                        \
      std::fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); \
      return 1;                                                           \
    }                                                                     \
    passed++;                                                             \
  } while (0)

static std::vector<uint16_t> sine(double vrms, double bias_mv, size_t n, double cycles, double noise = 0) {
  std::vector<uint16_t> out(n);
  unsigned s = 7;
  for (size_t i = 0; i < n; i++) {
    s = s * 1103515245 + 12345;
    double jitter = noise * (((s >> 16) & 0x7fff) / 32768.0 - 0.5);
    double v = bias_mv + vrms * 1000 * std::sqrt(2.0) * std::sin(2 * M_PI * cycles * i / n) + jitter;
    out[i] = static_cast<uint16_t>(std::lround(v));
  }
  return out;
}

int test_rms() {
  CtConfig c;  // SCT-013-030: 30 A/V
  auto s = sine(0.5, 1650, 1480, 10);  // 0.5 V rms → 15 A
  CHECK(std::fabs(rms_current(s.data(), s.size(), c) - 15.0f) < 0.1f);
  auto biased = sine(0.5, 1720, 1480, 10);  // bias drift doesn't matter
  CHECK(std::fabs(rms_current(biased.data(), biased.size(), c) - 15.0f) < 0.1f);
  auto idle = sine(0.0, 1650, 1480, 10, 3.0);  // ADC noise only
  CHECK(rms_current(idle.data(), idle.size(), c) == 0.0f);
  CHECK(rms_current(s.data(), 1, c) == 0.0f);
  return 0;
}

int test_energy() {
  EnergyCounter e;
  for (uint32_t t = 0; t <= 3600000; t += 5000) e.add(t, 1000.0f);  // 1 kW for an hour
  CHECK(std::fabs(e.wh - 1000.0) < 0.01);
  e.add(3600000 + 120000, 1000.0f);  // 2-minute gap is not bridged
  CHECK(std::fabs(e.wh - 1000.0) < 0.01);
  EnergyCounter w;
  w.add(0xFFFFF000u, 600.0f);  // millis() wrap-around
  w.add(0x00000F40u, 600.0f);  // 8 s later (0x1000 + 0xF40 = 8000 ms)
  CHECK(std::fabs(w.wh - 600.0 * 8 / 3600) < 0.001);
  return 0;
}

int test_ring() {
  RingBuffer<3, 16> r;
  CHECK(r.empty());
  r.push("a");
  r.push("b");
  r.push("c");
  r.push("d");  // drops "a"
  CHECK(r.size() == 3 && r.dropped() == 1);
  CHECK(std::strcmp(r.peek(), "b") == 0);
  r.pop();
  CHECK(std::strcmp(r.peek(), "c") == 0);
  CHECK(!r.push("this message is too long"));
  r.pop();
  r.pop();
  CHECK(r.empty() && r.peek() == nullptr);
  return 0;
}

int test_failsafe() {
  RoomController rc(0);
  Change ch[2];
  Change one;
  const char* err;
  rc.heartbeat(1000);
  CHECK(rc.command(0, false, &one, &err) && one.changed);  // lights off
  CHECK(rc.command(1, false, &one, &err));                 // hvac setback
  CHECK(rc.outputs().lights_relay_energized() && rc.outputs().hvac_relay_energized());
  CHECK(rc.tick(100000, ch) == 0);                         // 99 s: fine
  int n = rc.tick(121001, ch);                             // > 120 s without heartbeat
  CHECK(n == 2 && rc.failsafe());
  CHECK(ch[0].channel == 0 && ch[0].on && ch[0].source == Source::Failsafe);
  CHECK(rc.outputs().lights_on && rc.outputs().hvac_normal);
  CHECK(!rc.outputs().lights_relay_energized());           // de-energized = lights on
  CHECK(rc.tick(200000, ch) == 0);                         // reported once
  rc.heartbeat(200000);
  CHECK(!rc.failsafe());
  // Broker disconnect also fails safe.
  rc.command(0, false, &one, &err);
  CHECK(rc.disconnected(ch) == 1 && rc.outputs().lights_on);
  return 0;
}

int test_manual_override() {
  RoomController rc(0);
  Change ch[2];
  Change one;
  const char* err = nullptr;
  rc.heartbeat(0);
  rc.manual_switch(true, false, ch);
  CHECK(rc.manual() && !rc.outputs().lights_on && rc.outputs().source == Source::Manual);
  CHECK(!rc.command(0, true, &one, &err) && std::strcmp(err, "manual override active") == 0);
  CHECK(rc.tick(500000, ch) == 0);  // fail-safe doesn't fight a person at the switch
  rc.manual_switch(false, false, ch);
  CHECK(rc.command(0, true, &one, &err) && rc.outputs().lights_on);
  CHECK(!rc.command(5, true, &one, &err) && std::strcmp(err, "unknown channel") == 0);
  return 0;
}

int test_motion() {
  MotionReporter m;
  CHECK(m.should_report(1000));
  CHECK(!m.should_report(5000));
  CHECK(m.should_report(21000));
  return 0;
}

int test_payloads() {
  char buf[256];
  ChannelReading r[2] = {{0, 4.82f, 561.3f, 12873.4}, {1, 0.0f, 0.0f, 402.1}};
  int n = telemetry_json(buf, sizeof buf, 1767225600000ULL, 18234, r, 2);
  CHECK(n > 0);
  CHECK(std::strcmp(buf, "{\"ts\":1767225600000,\"seq\":18234,\"channels\":[{\"ch\":0,\"current_a\":4.820,\"power_w\":561.3,\"energy_wh\":12873.40},"
                         "{\"ch\":1,\"current_a\":0.000,\"power_w\":0.0,\"energy_wh\":402.10}]}") == 0);
  char small[40];
  CHECK(telemetry_json(small, sizeof small, 1, 1, r, 2) == -1);
  relay_event_json(buf, sizeof buf, 5, Change{true, 0, true, Source::Failsafe});
  CHECK(std::strcmp(buf, "{\"ts\":5,\"type\":\"relay\",\"ch\":0,\"state\":\"on\",\"source\":\"failsafe\"}") == 0);
  ack_json(buf, sizeof buf, 4812, true, nullptr);
  CHECK(std::strcmp(buf, "{\"id\":4812,\"ok\":true}") == 0);
  ack_json(buf, sizeof buf, 4813, false, "manual override active");
  CHECK(std::strcmp(buf, "{\"id\":4813,\"ok\":false,\"error\":\"manual override active\"}") == 0);
  return 0;
}

int main() {
  int (*tests[])() = {test_rms, test_energy, test_ring, test_failsafe, test_manual_override, test_motion, test_payloads};
  for (auto t : tests)
    if (t()) return 1;
  std::printf("%d firmware core checks passed\n", passed);
  return 0;
}
