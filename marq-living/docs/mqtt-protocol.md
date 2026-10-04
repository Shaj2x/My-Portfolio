# Marq Living MQTT protocol

Devices, the simulator and the Go services talk over MQTT (Mosquitto). All payloads are JSON (UTF-8). Each device's `hardware_id` is its MQTT client ID and its topic segment, for example `ct-laundry-01`. A device must be registered in **Staff → Devices** before its data is accepted.

| Topic | Direction | QoS | Retained | Purpose |
|---|---|---|---|---|
| `marq/dev/{hw}/telemetry` | device → | 1 | no | Electrical readings, every 5 s |
| `marq/dev/{hw}/status` | device → | 1 | **yes** | Online state, firmware, signal. Also the Last Will (`{"state":"offline"}`) |
| `marq/dev/{hw}/event` | device → | 1 | no | Discrete events: motion, relay changes, state of charge |
| `marq/dev/{hw}/cmd` | → device | 1 | no | Control commands from the automation engine |
| `marq/dev/{hw}/ack` | device → | 1 | no | Result of a command |
| `marq/sys/heartbeat` | engine → | 1 | **yes** | Automation engine alive signal, every 30 s |
| `marq/sys/events` | ingest → | 1 | no | Derived events (machine state, offline, power thresholds) for the automation engine |

## telemetry

```json
{
  "ts": 1767225600000,
  "seq": 18234,
  "channels": [
    { "ch": 0, "current_a": 4.82, "power_w": 561.3, "energy_wh": 12873.4 },
    { "ch": 1, "current_a": 0.03, "power_w": 0.0, "energy_wh": 402.1 }
  ]
}
```

- `ts`: Unix time in ms (from NTP on the ESP32). Readings buffered during a Wi-Fi outage are replayed with their original `ts` and are accepted up to 24 h old.
- `seq`: increases by one per message. The ingest service deduplicates replays on `(device, channel, ts)`.
- `power_w` is optional. Without a voltage sensor, the ingest service computes it as `current_a × voltage × power_factor`, using the device's calibration.
- `energy_wh` is optional. It is a lifetime counter that survives reboots (stored in NVS). If it's missing, the ingest service integrates power over time.

Calibration lives on the device record (`devices.calibration`). Ingest applies it, so recalibrating never needs a reflash:

```json
{ "channels": { "0": { "current_scale": 1.0, "current_offset_a": 0.02, "voltage": 120, "power_factor": 0.95 } } }
```

## status

```json
{ "state": "online", "fw": "1.3.0", "rssi": -61, "battery_pct": null, "uptime_s": 86400, "buffered": 0, "ip": "10.0.20.31" }
```

On connect, the device publishes this message retained. Its Last Will is `{"state":"offline"}`, also retained, so the broker announces a crash or power loss. The ingest service also marks a device offline if no telemetry arrives for 3 × its reporting interval (default 60 s).

## event

```json
{ "ts": 1767225600000, "type": "motion", "ch": 0, "value": 1 }
{ "ts": 1767225600000, "type": "relay", "ch": 0, "state": "off", "source": "failsafe" }
{ "ts": 1767225600000, "type": "soc", "value": 72.5 }
{ "ts": 1767225600000, "type": "temperature", "ch": 0, "value": 21.4 }
```

## cmd and ack

Every command comes from a row in `control_commands`, the audit log. Its `id` is that row's ID.

```json
{ "id": 4812, "relay": { "ch": 0, "state": "off" } }
{ "id": 4813, "hvac": { "mode": "setback", "setpoint_c": 17 } }
{ "id": 4814, "ev": { "limit_kw": 3.6 } }
{ "id": 4815, "config": { "interval_s": 5 } }
{ "id": 4816, "ota": { "url": "https://…/firmware-1.3.1.bin", "sha256": "…" } }
```

```json
{ "id": 4812, "ok": true }
{ "id": 4813, "ok": false, "error": "manual override active" }
```

A command not acknowledged within 30 s is marked `expired`.

## Fail-safe

The automation engine publishes `marq/sys/heartbeat` every 30 s (retained, `{"ts": …}`). If a relay or HVAC node sees no heartbeat for 120 s, or loses its broker connection, it reverts to its **fail-safe state** (lights on, HVAC normal/comfort) and reports a `relay` event with `"source":"failsafe"`. The wiring must also be fail-safe on its own: lights sit on the relay's normally-closed contact, so a dead node leaves them on.

A physical override switch on each relay node forces its outputs and reports `"source":"manual"`. Automation never fights a manual override.

## Security

Every device has its own Mosquitto username and password. The ACL limits each device to `marq/dev/{its hw}/#`. Services use their own accounts. In production, use TLS on port 8883 (see `infra/mosquitto/`).
