# Demo simulator

Simulates every device in the building so the whole system can be shown without hardware: washers and dryers running real power profiles, the theatre and game room following their relays and HVAC commands, PIR motion while rooms are booked, lobby base load, EV chargers obeying load-management limits, and a shuttle driving the route (GPS plus battery state of charge).

```sh
pip install -r requirements.txt
python -m marq_sim seed                   # register demo devices (flagged simulated)
python -m marq_sim backfill --days 28     # history for forecasting/analytics
python -m marq_sim live --drive-shuttle   # real-time MQTT, closed loop with the automation engine
python -m marq_sim live --fault dryer-2   # Dryer 2's heating element "fails" → fault, ticket, announcement
```

| Variable | Default |
|---|---|
| `MQTT_URL` | `tcp://localhost:1883` |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | none |
| `SUPABASE_DB_URL` | `postgresql://postgres:postgres@localhost:54322/postgres` |
| `TIMESCALE_URL` | `postgresql://postgres:postgres@localhost:5433/telemetry` |

Behaviour worth knowing for a demo:

- **Fail-safe.** Room nodes watch the automation engine's heartbeat. Stop the engine and within 2 minutes the lights come on and HVAC returns to normal, reported as `source: failsafe`.
- **Occupancy follows bookings**, with an occasional unbooked visit, which triggers the "room in use without a booking" staff alert.
- **Backfill** runs the rooms always-on for the first half of the period and automated for the second half, so the savings report has a real before and after.

Tests: `python -m pytest -q tests`
