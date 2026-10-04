"""Database access. Two databases: telemetry (TimescaleDB) and the app (Supabase)."""
from __future__ import annotations

import json
from contextlib import contextmanager
from dataclasses import dataclass

import psycopg
from psycopg.rows import dict_row

SYSTEMS = {
    "laundry": "Laundry",
    "theatre": "Theatre room",
    "game_room": "Game room",
    "common": "Lobby & common areas",
    "ev": "EV charging",
    "shuttle": "Shuttle charging",
    "other": "Other",
}


@contextmanager
def connect(url: str):
    with psycopg.connect(url, row_factory=dict_row, autocommit=True, connect_timeout=5) as conn:
        yield conn


@dataclass
class Channel:
    device_id: str
    channel: int
    device: str
    label: str
    system: str
    room_slug: str | None


def system_for(dev: dict, ch_cfg: dict) -> str:
    """Which system a metered channel belongs to: config wins, else inferred."""
    s = ch_cfg.get("system") or (dev.get("config") or {}).get("system")
    if s in SYSTEMS:
        return s
    loc = (dev.get("location") or "").lower()
    if dev.get("type") == "ev_charger":
        return "shuttle" if dev.get("fleet") else "ev"
    if "laundry" in loc:
        return "laundry"
    if "theatre" in loc or "theater" in loc:
        return "theatre"
    if "game" in loc:
        return "game_room"
    if "lobby" in loc or "corridor" in loc or "common" in loc:
        return "common"
    return "other"


def channels(app_url: str) -> dict[tuple[str, int], Channel]:
    """Metered channels with labels and systems, from the device registry."""
    with connect(app_url) as c:
        rows = c.execute("""
            select d.id::text as id, d.name, d.type::text as type, d.location, d.config, r.slug as room_slug,
                   coalesce(ch.fleet_only, false) as fleet
              from public.devices d
              left join public.rooms r on r.id = d.room_id
              left join public.ev_chargers ch on ch.device_id = d.id
             where d.type in ('ct_node', 'ev_charger') and d.status <> 'retired'""").fetchall()
    out: dict[tuple[str, int], Channel] = {}
    for d in rows:
        cfg = d["config"] if isinstance(d["config"], dict) else json.loads(d["config"] or "{}")
        d["config"] = cfg
        chans = cfg.get("channels") or {"0": {}}
        for k, ch_cfg in chans.items():
            out[(d["id"], int(k))] = Channel(d["id"], int(k), d["name"], ch_cfg.get("label") or f"{d['name']} ch{k}",
                                             system_for(d, ch_cfg), d["room_slug"])
    return out


def peak_limit_kw(app_url: str) -> float | None:
    with connect(app_url) as c:
        r = c.execute("select peak_limit_kw from public.energy_sources where kind = 'grid' and enabled order by name limit 1").fetchone()
    return float(r["peak_limit_kw"]) if r and r["peak_limit_kw"] is not None else None
