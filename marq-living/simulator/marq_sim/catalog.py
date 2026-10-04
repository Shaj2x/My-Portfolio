"""The demo building: every simulated device, machine, charger and room."""
from __future__ import annotations

LAUNDRY_HOURS = {"from": "07:00", "to": "01:00"}

DEVICES = [
    # hardware_id, name, type, location, circuit, config
    ("sim-ct-laundry-w", "Laundry CT (washers)", "ct_node", "Laundry room", "Panel L, breakers 1–4",
     {"interval_s": 5, "channels": {str(i): {"label": f"Washer {i + 1}", "max_w": 2200} for i in range(4)}}),
    ("sim-ct-laundry-d", "Laundry CT (dryers)", "ct_node", "Laundry room", "Panel L, breakers 5–12",
     {"interval_s": 5, "channels": {str(i): {"label": f"Dryer {i + 1}", "max_w": 7500} for i in range(4)}}),
    ("sim-ct-theatre", "Theatre CT", "ct_node", "Theatre room", "Panel B, breakers 14–15",
     {"interval_s": 5, "channels": {"0": {"label": "Lights & AV", "after_hours_max_w": 60, "expected_hours": {"from": "10:00", "to": "23:30"}},
                                    "1": {"label": "HVAC", "max_w": 4000}}}),
    ("sim-ct-gameroom", "Game room CT", "ct_node", "Game room", "Panel B, breakers 16–17",
     {"interval_s": 5, "channels": {"0": {"label": "Lights & consoles", "after_hours_max_w": 60, "expected_hours": {"from": "10:00", "to": "23:30"}},
                                    "1": {"label": "HVAC", "max_w": 3000}}}),
    ("sim-ct-lobby", "Lobby CT", "ct_node", "Lobby", "Panel A, main common",
     {"interval_s": 5, "channels": {"0": {"label": "Lobby & corridors"}}}),
    ("sim-pir-theatre", "Theatre occupancy", "pir", "Theatre room", None, {"interval_s": 30}),
    ("sim-pir-gameroom", "Game room occupancy", "pir", "Game room", None, {"interval_s": 30}),
    ("sim-relay-theatre", "Theatre controls", "relay", "Theatre room", "Panel B, breaker 14 (via contactor)",
     {"interval_s": 30, "outputs": {"lights": 0, "hvac": 1}}),
    ("sim-relay-gameroom", "Game room controls", "relay", "Game room", "Panel B, breaker 16 (via contactor)",
     {"interval_s": 30, "outputs": {"lights": 0, "hvac": 1}}),
    *[(f"sim-ev-p1-0{i}", f"EV charger P1-0{i}", "ev_charger", "Parking level 1", f"Panel P, breaker {20 + 2 * i}",
       {"interval_s": 5, "channels": {"0": {"label": "Charger"}}}) for i in range(1, 5)],
    ("sim-shuttle-ev", "Shuttle telematics", "shuttle_telematics", "Shuttle", None, {"interval_s": 30}),
]

LAUNDRY = [(f"Washer {i + 1}", "washer", "sim-ct-laundry-w", i) for i in range(4)] + \
          [(f"Dryer {i + 1}", "dryer", "sim-ct-laundry-d", i) for i in range(4)]

CHARGERS = [(f"P1-0{i}", f"sim-ev-p1-0{i}", 7.2, i == 4) for i in range(1, 5)]  # P1-04 is the shuttle's

ROOMS = {
    "theatre": {"ct": "sim-ct-theatre", "pir": "sim-pir-theatre", "relay": "sim-relay-theatre", "lights_w": 650, "hvac_w": 2200},
    "game-room": {"ct": "sim-ct-gameroom", "pir": "sim-pir-gameroom", "relay": "sim-relay-gameroom", "lights_w": 480, "hvac_w": 1600},
}


def seed(conn) -> None:
    """Register the demo devices in the app DB (idempotent). Rows are flagged simulated."""
    import json
    with conn.cursor() as cur:
        for hw, name, typ, loc, circuit, cfg in DEVICES:
            cur.execute(
                """insert into public.devices (hardware_id, name, type, location, circuit, config, simulated, status, firmware_version)
                   values (%s, %s, %s, %s, %s, %s, true, 'provisioning', 'sim-1.0')
                   on conflict (hardware_id) do update set name = excluded.name, config = excluded.config, simulated = true""",
                (hw, name, typ, loc, circuit, json.dumps(cfg)))
        for label, kind, hw, ch in LAUNDRY:
            cur.execute(
                """insert into public.laundry_machines (label, kind, device_id, channel, state)
                   select %s, %s, id, %s, 'idle' from public.devices where hardware_id = %s
                   on conflict (label) do update set device_id = excluded.device_id, channel = excluded.channel""",
                (label, kind, ch, hw))
        for label, hw, kw, fleet in CHARGERS:
            cur.execute(
                """insert into public.ev_chargers (label, device_id, max_kw, fleet_only, status)
                   select %s, id, %s, %s, 'online' from public.devices where hardware_id = %s
                   on conflict (label) do update set device_id = excluded.device_id""",
                (label, kw, fleet, hw))
        for slug, r in ROOMS.items():
            cur.execute(
                """update public.rooms set device_ids = (select array_agg(id) from public.devices where hardware_id = any(%s))
                    where slug = %s""",
                ([r["ct"], r["pir"], r["relay"]], slug))
            cur.execute("update public.devices set room_id = (select id from public.rooms where slug = %s) where hardware_id = any(%s)",
                        (slug, [r["ct"], r["pir"], r["relay"]]))
    conn.commit()
