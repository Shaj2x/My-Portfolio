// Marq Living ESP32 node. See README.md for wiring and docs/mqtt-protocol.md
// for the messages. Logic lives in lib/marq_core (unit-tested on the host);
// this file is the hardware glue.
#include <Arduino.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <HTTPClient.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <Update.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_task_wdt.h>
#include <mbedtls/sha256.h>
#include <time.h>

#include "config.h"
#include "marq_core.h"

#ifndef MARQ_FW_VERSION
#define MARQ_FW_VERSION "1.0.0"
#endif

using namespace marq;

static const char* T_TELEMETRY = "marq/dev/" MARQ_HW_ID "/telemetry";
static const char* T_STATUS = "marq/dev/" MARQ_HW_ID "/status";
static const char* T_EVENT = "marq/dev/" MARQ_HW_ID "/event";
static const char* T_CMD = "marq/dev/" MARQ_HW_ID "/cmd";
static const char* T_ACK = "marq/dev/" MARQ_HW_ID "/ack";
static const char* T_HEARTBEAT = "marq/sys/heartbeat";

#if MARQ_MQTT_TLS
WiFiClientSecure net;
#else
WiFiClient net;
#endif
PubSubClient mqtt(net);
Preferences prefs;

static uint32_t seq = 0;
static uint32_t interval_ms = MARQ_INTERVAL_MS;
static uint32_t last_report = 0, last_persist = 0, last_minute = 0, last_connect_try = 0;

// Up to ~20 minutes of 5-second messages in RAM; longer outages fall back to
// 1-minute summaries on flash (/buffer.jsonl), which also survive reboots.
static RingBuffer<240, 384> ram_buffer;
static const char* FLASH_BUFFER = "/buffer.jsonl";
static const size_t FLASH_BUFFER_MAX = 512 * 1024;

static uint64_t now_ms() {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  return static_cast<uint64_t>(tv.tv_sec) * 1000ULL + tv.tv_usec / 1000;
}
static bool clock_synced() { return time(nullptr) > 1700000000; }

// ---------------------------------------------------------------------------
// Publishing with offline buffering
// ---------------------------------------------------------------------------

static void flash_append(const char* line) {
  File f = LittleFS.open(FLASH_BUFFER, FILE_APPEND);
  if (!f) return;
  if (f.size() < FLASH_BUFFER_MAX) f.println(line);
  f.close();
}

static void publish_or_buffer(const char* topic, const char* payload, bool buffer) {
  if (mqtt.connected() && mqtt.publish(topic, payload)) return;
  if (buffer) ram_buffer.push(payload);
}

// Replay a little each loop so live data isn't starved after an outage.
static void drain_buffers() {
  if (!mqtt.connected()) return;
  for (int i = 0; i < 10 && !ram_buffer.empty(); i++) {
    if (!mqtt.publish(T_TELEMETRY, ram_buffer.peek())) return;
    ram_buffer.pop();
  }
  if (!ram_buffer.empty() || !LittleFS.exists(FLASH_BUFFER)) return;
  File f = LittleFS.open(FLASH_BUFFER, FILE_READ);
  bool ok = true;
  while (f && f.available() && ok) {
    String line = f.readStringUntil('\n');
    if (line.length() > 2) ok = mqtt.publish(T_TELEMETRY, line.c_str());
    mqtt.loop();
  }
  f.close();
  if (ok) LittleFS.remove(FLASH_BUFFER);  // all replayed (duplicates are ignored server-side)
}

static void publish_status(const char* state) {
  char buf[200];
  snprintf(buf, sizeof buf,
           "{\"state\":\"%s\",\"fw\":\"%s\",\"rssi\":%d,\"uptime_s\":%lu,\"buffered\":%u,\"ip\":\"%s\"}", state,
           MARQ_FW_VERSION, WiFi.RSSI(), millis() / 1000, static_cast<unsigned>(ram_buffer.size()),
           WiFi.localIP().toString().c_str());
  mqtt.publish(T_STATUS, buf, true);
}

// ---------------------------------------------------------------------------
// CT metering node
// ---------------------------------------------------------------------------
#if MARQ_NODE_CT
static const int ct_pins[MARQ_CT_COUNT] = MARQ_CT_PINS;
static EnergyCounter energy[MARQ_CT_COUNT];
static CtConfig ct_cfg;
static double minute_w[MARQ_CT_COUNT];
static int minute_n = 0;

// ~10 mains cycles per channel at ~9 kHz.
static float sample_channel(int pin) {
  static uint16_t mv[1500];
  const uint32_t start = micros();
  size_t n = 0;
  while (micros() - start < 166667 && n < sizeof mv / sizeof mv[0]) mv[n++] = analogReadMilliVolts(pin);
  return rms_current(mv, n, ct_cfg);
}

static void ct_setup() {
  ct_cfg.amps_per_volt = MARQ_CT_AMPS_PER_VOLT;
  analogReadResolution(12);
  for (int i = 0; i < MARQ_CT_COUNT; i++) {
    analogSetPinAttenuation(ct_pins[i], ADC_11db);
    char key[8];
    snprintf(key, sizeof key, "wh%d", i);
    energy[i].wh = prefs.getDouble(key, 0);
  }
}

static void ct_report() {
  ChannelReading r[MARQ_CT_COUNT];
  for (int i = 0; i < MARQ_CT_COUNT; i++) {
    const float a = sample_channel(ct_pins[i]);
    const float w = a * MARQ_NOMINAL_VOLTS * MARQ_POWER_FACTOR;
    energy[i].add(millis(), w);
    r[i] = ChannelReading{i, a, w, energy[i].wh};
    minute_w[i] += w;
  }
  minute_n++;
  if (!clock_synced()) return;  // never publish without a real timestamp
  char buf[384];
  if (telemetry_json(buf, sizeof buf, now_ms(), ++seq, r, MARQ_CT_COUNT) > 0) publish_or_buffer(T_TELEMETRY, buf, true);

  // Offline for a while: keep 1-minute averages on flash.
  if (!mqtt.connected() && millis() - last_minute >= 60000 && minute_n) {
    for (int i = 0; i < MARQ_CT_COUNT; i++) {
      const float w = minute_w[i] / minute_n;
      r[i] = ChannelReading{i, w / (MARQ_NOMINAL_VOLTS * MARQ_POWER_FACTOR), w, energy[i].wh};
      minute_w[i] = 0;
    }
    if (telemetry_json(buf, sizeof buf, now_ms(), ++seq, r, MARQ_CT_COUNT) > 0) flash_append(buf);
    minute_n = 0;
    last_minute = millis();
  } else if (mqtt.connected() && millis() - last_minute >= 60000) {
    for (auto& m : minute_w) m = 0;
    minute_n = 0;
    last_minute = millis();
  }
}

static void ct_persist() {
  for (int i = 0; i < MARQ_CT_COUNT; i++) {
    char key[8];
    snprintf(key, sizeof key, "wh%d", i);
    prefs.putDouble(key, energy[i].wh);  // every 5 min: NVS wear stays far below limits
  }
}
#endif

// ---------------------------------------------------------------------------
// Room node: PIR + relays with fail-safe
// ---------------------------------------------------------------------------
#if MARQ_NODE_ROOM
static RoomController* room;
static MotionReporter motion;
static volatile bool motion_flag = false;

static void IRAM_ATTR on_motion() { motion_flag = true; }

static void drive_relays() {
  const auto& o = room->outputs();
  const int on = MARQ_RELAY_ACTIVE_HIGH ? HIGH : LOW, off = MARQ_RELAY_ACTIVE_HIGH ? LOW : HIGH;
  digitalWrite(MARQ_LIGHTS_RELAY_PIN, o.lights_relay_energized() ? on : off);
  digitalWrite(MARQ_HVAC_RELAY_PIN, o.hvac_relay_energized() ? on : off);
}

static void report_changes(const Change* c, int n) {
  char buf[160];
  for (int i = 0; i < n; i++) {
    relay_event_json(buf, sizeof buf, now_ms(), c[i]);
    publish_or_buffer(T_EVENT, buf, false);
  }
}

static void room_setup() {
  room = new RoomController(millis());
  pinMode(MARQ_LIGHTS_RELAY_PIN, OUTPUT);
  pinMode(MARQ_HVAC_RELAY_PIN, OUTPUT);
  drive_relays();  // boot state: lights on, HVAC normal
  pinMode(MARQ_PIR_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(MARQ_PIR_PIN), on_motion, RISING);
  pinMode(MARQ_OVERRIDE_SWITCH_PIN, INPUT_PULLUP);
  pinMode(MARQ_OVERRIDE_LIGHTS_PIN, INPUT_PULLUP);
}

static void room_loop() {
  Change c[2];
  int n = room->tick(millis(), c);
  // Manual switch: debounced by sampling once per loop.
  const bool engaged = digitalRead(MARQ_OVERRIDE_SWITCH_PIN) == LOW;
  if (engaged != room->manual()) n += room->manual_switch(engaged, digitalRead(MARQ_OVERRIDE_LIGHTS_PIN) == LOW, c + n);
  if (n) {
    drive_relays();
    report_changes(c, n);
  }
  if ((motion_flag || digitalRead(MARQ_PIR_PIN) == HIGH) && motion.should_report(millis())) {
    motion_flag = false;
    char buf[96];
    snprintf(buf, sizeof buf, "{\"ts\":%llu,\"type\":\"motion\",\"ch\":0,\"value\":1}", static_cast<unsigned long long>(now_ms()));
    publish_or_buffer(T_EVENT, buf, false);
  }
}
#endif

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

static void ack(long long id, bool ok, const char* err) {
  char buf[160];
  ack_json(buf, sizeof buf, id, ok, err);
  mqtt.publish(T_ACK, buf);
}

// HTTPS OTA with SHA-256 check before the new image is activated.
static bool ota_update(const char* url, const char* sha_hex, const char** err) {
  WiFiClientSecure tls;
  tls.setInsecure();  // integrity comes from the SHA-256 in the signed-off command
  HTTPClient http;
  if (!http.begin(tls, url)) return *err = "bad url", false;
  if (http.GET() != 200) return *err = "download failed", false;
  const int len = http.getSize();
  if (len <= 0 || !Update.begin(len)) return *err = "no space for update", false;
  mbedtls_sha256_context sha;
  mbedtls_sha256_init(&sha);
  mbedtls_sha256_starts(&sha, 0);
  WiFiClient* s = http.getStreamPtr();
  uint8_t chunk[1024];
  int left = len;
  while (left > 0) {
    const int r = s->readBytes(chunk, min(left, static_cast<int>(sizeof chunk)));
    if (r <= 0) break;
    mbedtls_sha256_update(&sha, chunk, r);
    Update.write(chunk, r);
    left -= r;
    esp_task_wdt_reset();
  }
  uint8_t digest[32];
  mbedtls_sha256_finish(&sha, digest);
  char hex[65];
  for (int i = 0; i < 32; i++) sprintf(hex + 2 * i, "%02x", digest[i]);
  if (left != 0 || strcasecmp(hex, sha_hex) != 0) {
    Update.abort();
    return *err = "checksum mismatch", false;
  }
  if (!Update.end(true)) return *err = "update failed", false;
  return true;
}

static void on_message(char* topic, byte* payload, unsigned int len) {
#if MARQ_NODE_ROOM
  if (strcmp(topic, T_HEARTBEAT) == 0) {
    room->heartbeat(millis());
    return;
  }
#endif
  if (strcmp(topic, T_CMD) != 0) return;
  JsonDocument doc;
  if (deserializeJson(doc, payload, len)) return;
  const long long id = doc["id"] | 0LL;
  const char* err = nullptr;
  bool ok = false;
#if MARQ_NODE_ROOM
  Change c{};
  if (doc["relay"].is<JsonObject>()) {
    ok = room->command(doc["relay"]["ch"] | -1, strcmp(doc["relay"]["state"] | "", "on") == 0, &c, &err);
  } else if (doc["hvac"].is<JsonObject>()) {
    const char* mode = doc["hvac"]["mode"] | "";
    ok = room->command(1, strcmp(mode, "comfort") == 0, &c, &err);  // setback/off energize the setback relay
  }
  if (ok) {
    drive_relays();
    if (c.changed) report_changes(&c, 1);
  }
#endif
  if (doc["config"].is<JsonObject>()) {
    const uint32_t iv = doc["config"]["interval_s"] | 0;
    if (iv >= 1 && iv <= 300) {
      interval_ms = iv * 1000;
      prefs.putUInt("interval", interval_ms);
      ok = true;
    } else {
      err = "interval_s must be 1–300";
    }
  }
  if (doc["ota"].is<JsonObject>()) {
    ack(id, true, nullptr);  // accepted; the device reboots into the new version
    if (ota_update(doc["ota"]["url"] | "", doc["ota"]["sha256"] | "", &err)) ESP.restart();
    ack(id, false, err);
    return;
  }
  if (!ok && !err) err = "unsupported command";
  ack(id, ok, err);
}

// ---------------------------------------------------------------------------
// Connectivity
// ---------------------------------------------------------------------------

static void ensure_connected() {
  if (WiFi.status() != WL_CONNECTED) {
#if MARQ_NODE_ROOM
    Change c[2];
    const int n = room->disconnected(c);
    if (n) drive_relays();
#endif
    return;  // WiFi auto-reconnects
  }
  if (mqtt.connected() || millis() - last_connect_try < 5000) return;
  last_connect_try = millis();
  if (mqtt.connect(MARQ_HW_ID, MARQ_HW_ID, MARQ_MQTT_PASSWORD, T_STATUS, 1, true, "{\"state\":\"offline\"}")) {
    publish_status("online");
    mqtt.subscribe(T_CMD, 1);
#if MARQ_NODE_ROOM
    mqtt.subscribe(T_HEARTBEAT, 1);
#endif
  }
#if MARQ_NODE_ROOM
  else {
    Change c[2];
    if (room->disconnected(c)) drive_relays();
  }
#endif
}

void setup() {
  Serial.begin(115200);
  esp_task_wdt_init(30, true);  // reboot if the loop hangs for 30 s
  esp_task_wdt_add(nullptr);
  prefs.begin("marq", false);
  interval_ms = prefs.getUInt("interval", MARQ_INTERVAL_MS);
  LittleFS.begin(true);
#if MARQ_NODE_ROOM
  room_setup();  // relays first: fail-safe state before anything else
#endif
#if MARQ_NODE_CT
  ct_setup();
#endif
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(MARQ_WIFI_SSID, MARQ_WIFI_PASSWORD);
  configTzTime("EST5EDT,M3.2.0,M11.1.0", "pool.ntp.org", "time.nrc.ca");
  mqtt.setServer(MARQ_MQTT_HOST, MARQ_MQTT_PORT);
  mqtt.setCallback(on_message);
  mqtt.setBufferSize(1024);
#if MARQ_MQTT_TLS
  net.setInsecure();  // replace with net.setCACert(ca_pem) for the building CA
#endif
  ArduinoOTA.setHostname(MARQ_HW_ID);
  ArduinoOTA.setPassword(MARQ_OTA_PASSWORD);
  ArduinoOTA.begin();
}

void loop() {
  esp_task_wdt_reset();
  ensure_connected();
  mqtt.loop();
  ArduinoOTA.handle();
#if MARQ_NODE_ROOM
  room_loop();
#endif
  if (millis() - last_report >= interval_ms) {
    last_report = millis();
#if MARQ_NODE_CT
    ct_report();
#endif
    if (mqtt.connected() && (seq % 12) == 0) publish_status("online");  // once a minute at 5 s
  }
#if MARQ_NODE_CT
  if (millis() - last_persist >= 300000) {
    last_persist = millis();
    ct_persist();
  }
#endif
  drain_buffers();
  delay(5);
}
