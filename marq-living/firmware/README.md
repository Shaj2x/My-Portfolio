# Marq Living node firmware (ESP32)

There are two node types, built from the same code:

| Build | What it does |
|---|---|
| `ct_node` | Up to 4 SCT-013 clamps. It reports current, power and a lifetime energy counter every 5 s. |
| `room_node` | Reads a PIR occupancy sensor, drives a lights relay and an HVAC setback relay, and has a physical override switch. |

The logic lives in `lib/marq_core/marq_core.h`, which has no hardware dependencies: RMS current, energy integration, offline buffer, fail-safe state machine, payloads. It is unit-tested on a laptop. `src/main.cpp` is the glue to the ESP32 (ADC, Wi-Fi, MQTT, NVS, LittleFS, GPIO, OTA). The MQTT messages are specified in [docs/mqtt-protocol.md](../docs/mqtt-protocol.md).

```sh
make -C test/host                        # core unit tests (no hardware)
cp include/config.example.h include/config.h   # Wi-Fi, broker, hardware ID, clamp rating
pio run -e ct_node -t upload             # first flash over USB
pio run -e ct_node -t upload --upload-port ct-laundry-01.local   # later: OTA on the LAN
```

CI compiles both builds (`.github/workflows/marq-living.yml`).

## Safety first

- **Monitoring is non-invasive.** SCT-013 clamps go *around* one conductor of a circuit. Nothing is cut or connected to mains. Even so, opening a panel is work for a **licensed electrician**: the clamps go on in a de-energized panel, and the cable leaves through a proper knockout and bushing.
- **Switching is not DIY.** Relay nodes never switch line voltage directly. They drive the coil of a **certified contactor or relay module in a rated, listed enclosure** (CSA/cUL). An electrician installs and wires it. The ESP32 side stays low-voltage (3.3 V logic, 24 VAC or 12 VDC coil supply).
- **Fail-safe by wiring, not just by software.** Lights run through the relay's **normally-closed** contact, so a dead, unpowered or rebooting node leaves them **on**. The HVAC "setback" relay only *adds* a setback signal (or switches the thermostat to an unoccupied schedule). De-energized means normal operation.
- **Fail-safe in software too.** If the automation heartbeat (`marq/sys/heartbeat`) is missing for 120 s, or the broker connection drops, the node returns to lights on and HVAC normal. It reports this as `"source":"failsafe"`.
- **People win.** The override switch on each room node forces the outputs. While it's engaged, automation commands are refused and reported back.

## Bill of materials (per node)

| Part | Notes |
|---|---|
| ESP32-DevKitC (WROOM-32E) | Any ESP32 with ADC1 pins 32–39 broken out |
| SCT-013-030 (30 A) or -050/-100 | Voltage-output versions (1 V at rated current) need no burden resistor. Use -000 (current output) only with a 33 Ω burden. |
| 3.5 mm TRS jacks, 10 kΩ + 10 kΩ divider, 10 µF cap per clamp | Biases the clamp to ~1.65 V (mid-rail) |
| (Optional) ADS1115 16-bit ADC | Better accuracy at low loads than the ESP32 ADC |
| Room node: PIR (e.g. Panasonic EKMC or HC-SR501) | Ceiling-mounted, covering the seating area |
| Room node: 2× relay module with opto-isolation, driving certified contactors | See Safety |
| DIN-rail 5 V supply, enclosure | Low-voltage section of the panel or an adjacent box |

### CT input wiring (one channel)

```
 3.3V ──[10k]──┬──[10k]── GND      bias divider → 1.65 V "mid-rail" node
               ├──[10µF]── GND     keeps the bias steady
               │
               └──── clamp lead A
                     clamp lead B ──── ADC pin (GPIO 36 / 39 / 34 / 35, ADC1 only)
```

The clamp's AC output swings around 1.65 V. At 30 A RMS a -030 clamp gives 1 V RMS (±1.41 V peak), which is inside 0.24–3.06 V and so within the ESP32's usable range with 11 dB attenuation.

## Calibration (per channel)

1. Put a known resistive load on the circuit, such as a 1,500 W heater or a dryer heating cycle.
2. Read the true current with a clamp meter (true-RMS) at the same conductor.
3. In **Staff → Devices → Edit**, set the channel's calibration so the dashboard matches:

   ```json
   {"channels": {"0": {"current_scale": 1.03, "current_offset_a": 0.05, "voltage": 120, "power_factor": 1.0}}}
   ```

   - `current_scale` = clamp-meter reading ÷ dashboard reading at load.
   - `current_offset_a` = reading with the circuit off (the noise floor).
   - `voltage` = 120 or 240 for the circuit. `power_factor` ≈ 1.0 for heaters, 0.8–0.95 for motors.
4. Calibration is applied by the ingest service, so you never need to reflash.

## Offline behaviour

- Every message carries an NTP timestamp. The node never publishes before its clock is synced.
- With the broker unreachable, about 20 minutes of 5-second readings are kept in RAM. Beyond that, 1-minute averages go to flash (`/buffer.jsonl`, up to 512 KB, which survives reboots).
- On reconnect it replays the buffer, oldest first, a few messages per loop. Readings up to 24 h old are accepted, and duplicates are ignored by the server.
- Energy counters are saved to NVS every 5 minutes, so a reboot loses at most 5 minutes of counter increments. The ingest service keeps the series continuous.
- A 30-second watchdog reboots the node if the main loop hangs.

## Firmware updates

- **On the LAN:** ArduinoOTA (password in `config.h`).
- **Remotely:** send `{"ota":{"url":"https://…/firmware.bin","sha256":"…"}}` as a control command. The node downloads the image, checks the SHA-256, and only then switches to it. If the hash doesn't match, it keeps running the current image and acknowledges with an error. Two OTA partitions (`min_spiffs.csv`) mean a bad download can never brick the node.

## Stage 10: prototype on one circuit

This validates the whole hardware-to-dashboard pipeline on a single circuit before rolling out. The laundry dryer circuit is a good choice: its load is large and distinctive.

1. **Register** the node in Staff → Devices (`ct-laundry-proto`, type CT clamp node, system `laundry`, channel 0 labelled "Dryer 1", `max_w` 7500). Create its MQTT login: `infra/mosquitto/make-passwords.sh ct-laundry-proto <password>`.
2. **Install** (electrician): de-energize, clamp one hot leg of the dryer's 240 V circuit, route the cable out, re-energize. In `config.h`, set `MARQ_CT_COUNT 1` and `MARQ_NOMINAL_VOLTS 240.0f`.
3. **Link** the machine: in `laundry_machines`, set Dryer 1's `device_id` to the new node and `channel` 0.
4. **Check the pipeline end to end:**
   - [ ] Device shows **online**, with firmware and signal, within a minute (Staff → Devices).
   - [ ] **Idle**: the reading is under 20 W (noise floor). Set `current_offset_a` if needed.
   - [ ] **Calibrate** against a true-RMS clamp meter during heating. It should be within ±3% after calibration.
   - [ ] Over a **full cycle**, the laundry page goes Free → In use → Finishing soon → Free, and a test tenant using "Notify me" gets a push.
   - [ ] **Energy**: the cycle's kWh (Staff → Energy) is within ±5% of current × voltage × time from the clamp meter.
   - [ ] **Outage**: unplug the Wi-Fi access point for 10 minutes mid-cycle. When it's restored, the gap backfills with no duplicates, and the device shows offline then online, with no ticket (offline under 15 minutes).
   - [ ] **Reboot**: power-cycle the node. The energy counter continues, and the last will marks it offline and then back online.
   - [ ] **Fault drill**: in the simulator, `python -m marq_sim live --fault dryer-2` shows what a heater failure produces: a system ticket, out-of-service on the laundry page, and a building announcement.
5. Record the measurements in the device's notes. Then roll out to the remaining laundry circuits, the theatre and game room (CT plus room nodes), the lobby, and the EV chargers.
