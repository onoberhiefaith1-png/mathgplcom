#!/usr/bin/env bash
# Fills the templates (livekit.yaml, egress.yaml, caddy.yaml) from .env into
# generated/. Run again after any change to .env or a template, then
# `docker compose up -d` (add `--profile recording` if you use egress).
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "No .env here. Run: cp .env.example .env && nano .env" >&2; exit 1; }
set -a; . ./.env; set +a

fail() { echo "ERROR: $*" >&2; exit 1; }
for v in LK_DOMAIN LK_TURN_DOMAIN LIVEKIT_API_KEY LIVEKIT_API_SECRET; do
  [ -n "${!v:-}" ] || fail "$v is empty in .env"
done
case "$LK_DOMAIN$LK_TURN_DOMAIN" in *example.com*) fail "Set LK_DOMAIN and LK_TURN_DOMAIN to your real domains";; esac
[ "$LK_DOMAIN" != "$LK_TURN_DOMAIN" ] || fail "LK_DOMAIN and LK_TURN_DOMAIN must be different names"
case "$LIVEKIT_API_KEY$LIVEKIT_API_SECRET" in *changeme*|*change-me*) fail "Make a real API key and secret (README: Make the API key)";; esac
[ "${#LIVEKIT_API_SECRET}" -ge 32 ] || fail "LIVEKIT_API_SECRET must be at least 32 characters"

# Replace only the listed ${VARS}; envsubst if present, else python3 (both ship with Ubuntu).
fill() {
  if command -v envsubst >/dev/null; then
    envsubst "$VARS"
  else
    VARS="$VARS" python3 -c 'import os,re,sys; names=re.findall(r"\$\{(\w+)\}", os.environ["VARS"]); t=sys.stdin.read(); [t := t.replace("${%s}" % n, os.environ.get(n, "")) for n in names]; sys.stdout.write(t)'
  fi
}

umask 077
mkdir -p generated
chmod 700 generated   # only root/you can open the folder; containers read the mounted files directly
VARS='${LK_DOMAIN} ${LK_TURN_DOMAIN} ${LIVEKIT_API_KEY} ${LIVEKIT_API_SECRET} ${EGRESS_S3_ENDPOINT} ${EGRESS_S3_REGION} ${EGRESS_S3_BUCKET} ${EGRESS_S3_ACCESS_KEY} ${EGRESS_S3_SECRET}'
for f in livekit.yaml caddy.yaml egress.yaml; do
  fill < "$f" > "generated/$f"
  chmod 644 "generated/$f"
done
if cat generated/*.yaml | grep -v '^ *#' | grep -q '\$[{]'; then fail "A placeholder was left unfilled in generated/"; fi
if [ -z "${EGRESS_S3_ACCESS_KEY:-}" ] || [ -z "${EGRESS_S3_SECRET:-}" ]; then
  echo "Note: EGRESS_S3_* not set. Fine unless you start the recording profile."
fi
echo "Wrote generated/livekit.yaml, generated/caddy.yaml, generated/egress.yaml"
