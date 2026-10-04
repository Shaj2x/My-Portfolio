// Per-node settings. Copy to config.h (git-ignored) and fill in.
#pragma once

// Network
#define MARQ_WIFI_SSID "marq-iot"            // building IoT VLAN
#define MARQ_WIFI_PASSWORD "change-me"
#define MARQ_MQTT_HOST "10.0.20.5"
#define MARQ_MQTT_PORT 1883                  // 8883 with TLS (set MARQ_MQTT_TLS 1)
#define MARQ_MQTT_TLS 0
// Must match the device's Hardware ID in Staff → Devices; it's also the
// MQTT username (infra/mosquitto/make-passwords.sh <hw> <password>).
#define MARQ_HW_ID "ct-laundry-01"
#define MARQ_MQTT_PASSWORD "change-me"
#define MARQ_OTA_PASSWORD "change-me"        // ArduinoOTA on the LAN

// Reporting
#define MARQ_INTERVAL_MS 5000

// CT node: up to 4 SCT-013 clamps on ADC1 pins (ADC2 is unusable with Wi-Fi).
// Calibration fine-tuning happens server-side (devices.calibration); set the
// clamp rating here.
#define MARQ_CT_PINS {36, 39, 34, 35}
#define MARQ_CT_COUNT 4
#define MARQ_CT_AMPS_PER_VOLT 30.0f          // SCT-013-030
#define MARQ_NOMINAL_VOLTS 120.0f            // 240 for dryers/EV circuits
#define MARQ_POWER_FACTOR 0.95f

// Room node.
#define MARQ_PIR_PIN 27
#define MARQ_LIGHTS_RELAY_PIN 25             // lights on the relay's NC contact
#define MARQ_HVAC_RELAY_PIN 26               // energized = setback
#define MARQ_RELAY_ACTIVE_HIGH 1
#define MARQ_OVERRIDE_SWITCH_PIN 32          // physical manual override (to GND)
#define MARQ_OVERRIDE_LIGHTS_PIN 33          // override position: lights on (to GND) / off
