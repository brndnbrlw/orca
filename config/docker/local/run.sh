#!/bin/sh
set -eu
engine=${CONTAINER_ENGINE:-podman}
image=${ORCA_IMAGE:-localhost/orca:local}
profile=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/chromium-seccomp.json
if "$engine" container inspect orca >/dev/null 2>&1; then
  printf '%s\n' 'Container orca already exists. Replace it explicitly, preserving orca-data.' >&2
  exit 1
fi
"$engine" run -d --name orca -p 127.0.0.1:6768:6768 -v orca-data:/data --read-only --tmpfs /tmp:rw,nosuid,nodev,size=512m --cap-drop ALL --security-opt no-new-privileges --security-opt "seccomp=$profile" --pids-limit 512 --memory 4g --cpus 2 --shm-size 256m --stop-timeout 30 --restart unless-stopped "$image"
printf '%s\n' 'Orca: http://127.0.0.1:6768/. Pair: podman exec orca orca pair --address 127.0.0.1 --rotate'
