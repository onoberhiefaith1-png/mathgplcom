#!/usr/bin/env bash
# Syntax/lint checks for infra/livekit scripts, plus the summariser unit tests.
#   infra/livekit/loadtest/test/check.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
scripts=(render-config.sh firewall-setup.sh loadtest/run-load-test.sh loadtest/monitor-server.sh loadtest/test/check.sh)
for s in "${scripts[@]}"; do bash -n "$s"; done
echo "bash -n: ok (${#scripts[@]} scripts)"
if command -v shellcheck >/dev/null; then
  shellcheck "${scripts[@]}"
  echo "shellcheck: ok"
else
  echo "shellcheck: not installed, skipped (apt install shellcheck)"
fi
python3 -m py_compile loadtest/summarise.py
python3 -m unittest discover -s loadtest/test -q
echo "summariser tests: ok"
