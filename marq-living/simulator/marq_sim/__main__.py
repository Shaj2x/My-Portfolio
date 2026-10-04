"""python -m marq_sim {seed,live,backfill} — see simulator/README.md."""
import argparse
import logging
import os
import signal

import psycopg

from . import backfill, catalog, live


def main() -> None:
    ap = argparse.ArgumentParser(prog="marq_sim")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("seed", help="register demo devices, laundry machines, chargers and room wiring")
    lv = sub.add_parser("live", help="publish live telemetry over MQTT and obey commands")
    lv.add_argument("--drive-shuttle", action="store_true", help="act as the shuttle driver for due runs")
    lv.add_argument("--fault", action="append", default=[], help="inject a fault, e.g. --fault dryer-2 (heater failed)")
    lv.add_argument("--seed", type=int, default=None)
    bf = sub.add_parser("backfill", help="write history into TimescaleDB for analytics")
    bf.add_argument("--days", type=int, default=28)
    bf.add_argument("--automation-from-day", type=int, default=None)
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    app_dsn = os.environ.get("SUPABASE_DB_URL", "postgresql://postgres:postgres@localhost:54322/postgres")

    if args.cmd == "seed":
        with psycopg.connect(app_dsn) as conn:
            catalog.seed(conn)
        logging.info("registered %d simulated devices", len(catalog.DEVICES))
    elif args.cmd == "backfill":
        backfill.backfill(os.environ.get("TIMESCALE_URL", "postgresql://postgres:postgres@localhost:5433/telemetry"),
                          app_dsn, args.days, args.automation_from_day)
    else:
        sim = live.Sim(os.environ.get("MQTT_URL", "tcp://localhost:1883"), app_dsn, args.drive_shuttle, args.fault, args.seed,
                       os.environ.get("MQTT_USERNAME"), os.environ.get("MQTT_PASSWORD"))
        signal.signal(signal.SIGTERM, lambda *_: sim.stop.set())
        signal.signal(signal.SIGINT, lambda *_: sim.stop.set())
        sim.run()


if __name__ == "__main__":
    main()
