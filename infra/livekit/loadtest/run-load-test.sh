#!/usr/bin/env bash
# Stepped LiveKit load test: 1 audio publisher (the "teacher") + N listeners.
# Run on one or more CLIENT machines, never on the LiveKit server itself.
#
#   export LIVEKIT_URL=wss://livekit.example.com
#   export LIVEKIT_API_KEY=...  LIVEKIT_API_SECRET=...   # never put these in files
#   ./run-load-test.sh                                  # 100 250 500 750 1000
#
# Settings (environment variables):
#   STAGES="100 250 500 750 1000"  total listeners per stage, across ALL machines
#   STAGE_DURATION=180             seconds each stage holds once everyone is in
#   JOIN_RATE=10                   new listeners per second, per machine
#   COOLDOWN=30                    seconds of rest between stages
#   MACHINES=1                     how many client machines share the load
#   MACHINE_INDEX=1                this machine's number (1..MACHINES); only 1 publishes
#   START_AT=<epoch seconds>       shared start time so all machines step together
#                                  (default: now; with MACHINES>1 it is required)
#   ROOM=mathemagine-load-test     room name (the same on every machine)
#   RESULTS_DIR=./results          where results/<time>-<host>/ is written
#   LK_BIN=lk                      path to the LiveKit CLI
#   ALLOW_LOCAL=1                  allow running against this same machine (box smoke tests only)
set -euo pipefail

STAGES=${STAGES:-"100 250 500 750 1000"}
STAGE_DURATION=${STAGE_DURATION:-180}
JOIN_RATE=${JOIN_RATE:-10}
COOLDOWN=${COOLDOWN:-30}
MACHINES=${MACHINES:-1}
MACHINE_INDEX=${MACHINE_INDEX:-1}
ROOM=${ROOM:-mathemagine-load-test}
RESULTS_DIR=${RESULTS_DIR:-./results}
LK_BIN=${LK_BIN:-lk}
ALLOW_LOCAL=${ALLOW_LOCAL:-0}

die() { echo "ERROR: $*" >&2; exit 1; }
is_int() { [[ "$1" =~ ^[0-9]+$ ]]; }

[ -n "${LIVEKIT_URL:-}" ] || die "export LIVEKIT_URL=wss://livekit.<your-domain> first"
[ -n "${LIVEKIT_API_KEY:-}" ] || die "export LIVEKIT_API_KEY first"
[ -n "${LIVEKIT_API_SECRET:-}" ] || die "export LIVEKIT_API_SECRET first"
command -v "$LK_BIN" >/dev/null || die "LiveKit CLI not found (README: install lk), or set LK_BIN"
for v in STAGE_DURATION JOIN_RATE COOLDOWN MACHINES MACHINE_INDEX; do is_int "${!v}" || die "$v must be a whole number"; done
for s in $STAGES; do is_int "$s" || die "STAGES must be whole numbers, got '$s'"; done
[ "$JOIN_RATE" -ge 1 ] || die "JOIN_RATE must be at least 1"
{ [ "$MACHINE_INDEX" -ge 1 ] && [ "$MACHINE_INDEX" -le "$MACHINES" ]; } || die "MACHINE_INDEX must be 1..$MACHINES"
if [ "$MACHINES" -gt 1 ] && [ -z "${START_AT:-}" ]; then
  die "With MACHINES>1 set the same START_AT on every machine, e.g. START_AT=\$(date -d '+5 min' +%s)"
fi

# The load generator must not be the server: it would steal the CPU being measured.
host=$(printf '%s' "$LIVEKIT_URL" | sed -E 's#^[a-z]+://##; s#[:/].*$##')
target_ips=$(getent ahosts "$host" 2>/dev/null | awk '{print $1}' | sort -u || true)
local_ips=$(hostname -I 2>/dev/null || true)
for ip in $target_ips; do
  case " $local_ips 127.0.0.1 ::1 " in
    *" $ip "*) [ "$ALLOW_LOCAL" = 1 ] || die "$host resolves to THIS machine ($ip). Run the load from other machines (set ALLOW_LOCAL=1 only for a local smoke test)." ;;
  esac
done

per_machine() { # listeners this machine runs for a stage total
  local total=$1 base extra
  base=$(( total / MACHINES )); extra=$(( total % MACHINES ))
  if [ "$MACHINE_INDEX" -le "$extra" ]; then echo $(( base + 1 )); else echo "$base"; fi
}

# Every machine computes the same timetable, so they step together.
max_stage=0; for s in $STAGES; do [ "$s" -gt "$max_stage" ] && max_stage=$s; done
max_ramp=$(( (max_stage / MACHINES + 1 + JOIN_RATE - 1) / JOIN_RATE + 15 ))
SLOT=$(( max_ramp + STAGE_DURATION + COOLDOWN ))
START_AT=${START_AT:-$(date +%s)}

# Each listener uses several sockets; lift the open-file limit as far as allowed.
need_fds=$(( max_stage * 8 / MACHINES + 1024 ))
ulimit -n "$(ulimit -Hn)" 2>/dev/null || true
if [ "$(ulimit -n)" != unlimited ] && [ "$(ulimit -n)" -lt "$need_fds" ]; then
  echo "WARNING: open-file limit $(ulimit -n) < ~$need_fds needed. Raise it (README: ulimit) or listeners will fail on this machine." >&2
fi

stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="$RESULTS_DIR/${stamp}-$(hostname -s)-m${MACHINE_INDEX}"
mkdir -p "$out"
stages_csv="$out/stages.csv"
echo "stage_total,machine,machines,subscribers_here,publishers_here,start_epoch,connected_epoch,end_epoch,exit_code,file" > "$stages_csv"
{
  echo "url_host=$host"; echo "room=$ROOM"; echo "stages=$STAGES"; echo "stage_duration=$STAGE_DURATION"
  echo "join_rate=$JOIN_RATE"; echo "machines=$MACHINES"; echo "machine_index=$MACHINE_INDEX"
  echo "start_at=$START_AT"; echo "slot_seconds=$SLOT"; echo "lk_version=$("$LK_BIN" --version 2>/dev/null | head -1)"
} > "$out/run.env"

echo "Results → $out   (stage slot ${SLOT}s, first stage at $(date -d "@$START_AT" '+%H:%M:%S' 2>/dev/null || date -r "$START_AT" '+%H:%M:%S'))"
i=0
for total in $STAGES; do
  slot_start=$(( START_AT + i * SLOT )); i=$(( i + 1 ))
  now=$(date +%s)
  if [ "$now" -lt "$slot_start" ]; then sleep $(( slot_start - now )); fi
  subs=$(per_machine "$total")
  pubs=0; [ "$MACHINE_INDEX" -eq 1 ] && pubs=1
  file="stage-$(printf '%04d' "$total").txt"
  echo "== Stage $total listeners: $subs here, publisher here: $pubs ($(date '+%H:%M:%S'))"
  start=$(date +%s)
  set +e
  # Audio only: --audio-publishers, no --video-publishers. lk publishes its own Opus test track.
  # The log is watched for "Finished connecting" to mark when the steady part starts.
  "$LK_BIN" load-test \
      --room "$ROOM" \
      --audio-publishers "$pubs" \
      --subscribers "$subs" \
      --num-per-second "$JOIN_RATE" \
      --identity-prefix "lt${total}m${MACHINE_INDEX}" \
      --duration "${STAGE_DURATION}s" 2>&1 \
    | while IFS= read -r line; do
        printf '%s\n' "$line"
        case "$line" in *"Finished connecting"*) date +%s > "$out/.connected";; esac
      done > "$out/$file"
  code=${PIPESTATUS[0]}
  set -e
  end=$(date +%s)
  connected=$(cat "$out/.connected" 2>/dev/null || echo "$start"); rm -f "$out/.connected"
  echo "$total,$MACHINE_INDEX,$MACHINES,$subs,$pubs,$start,$connected,$end,$code,$file" >> "$stages_csv"
  grep -E '│ Total' "$out/$file" | tail -1 || echo "   (no summary row; see $out/$file)"
done
echo "Done. Copy $out (and the server's monitor CSV) to one place and run: ./summarise.py --monitor <csv> $out [more result folders]"
