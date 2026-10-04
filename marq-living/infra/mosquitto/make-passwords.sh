#!/usr/bin/env sh
# Creates mosquitto/passwd with service accounts and one account per device.
# Usage: ./make-passwords.sh            (reads passwords from ../.env)
#        ./make-passwords.sh ct-laundry-01 <password>   (add/replace a device)
set -eu
cd "$(dirname "$0")"
touch passwd
chmod 600 passwd
run() { docker run --rm -v "$PWD:/m" eclipse-mosquitto:2 mosquitto_passwd -b /m/passwd "$1" "$2"; }
if [ $# -eq 2 ]; then
  run "$1" "$2"
  exit 0
fi
. ../.env
run ingest "$MQTT_INGEST_PASSWORD"
run automation "$MQTT_AUTOMATION_PASSWORD"
run simulator "$MQTT_SIMULATOR_PASSWORD"
echo "wrote mosquitto/passwd"
