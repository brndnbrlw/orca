#!/bin/sh
set -eu
exec /usr/bin/python3 /opt/orca/agent-runtimes/runtime-auth.py codex-run "$@"
