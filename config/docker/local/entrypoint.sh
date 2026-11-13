#!/bin/sh
set -eu
umask 077
if [ "$(id -u)" = 0 ]; then
  echo 'Orca must run as an unprivileged user.' >&2
  exit 1
fi
mkdir -p /data/home /data/state /data/workspaces
exec node /opt/orca/orcad/orcad-server.js --bind 0.0.0.0 --port 6768 --refuse-public --no-pairing --web-client-root /opt/orca/web --json
