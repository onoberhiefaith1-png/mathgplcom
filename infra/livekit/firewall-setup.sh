#!/usr/bin/env bash
# Opens the LiveKit ports on the Ubuntu server itself (ufw, or Oracle's
# iptables rules). Oracle ALSO needs the same ports in the VCN Security List;
# that part is done in the Oracle console (printed at the end, see README).
#
#   sudo ./firewall-setup.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo $0" >&2; exit 1; }

# proto  port(s)        why
RULES=(
  "tcp 22          SSH (kept open so you are not locked out)"
  "tcp 80          Caddy: Let's Encrypt HTTP challenge"
  "tcp 443         Caddy: wss signalling + TURN/TLS"
  "tcp 7881        WebRTC over TCP"
  "udp 50000:60000 WebRTC over UDP (media)"
  "udp 3478        TURN/UDP"
  "tcp 5349        TURN/TCP (optional; TURN/TLS already goes through 443)"
)

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  echo "ufw is active: adding rules"
  for r in "${RULES[@]}"; do
    read -r proto port _ <<<"$r"
    ufw allow "${port}/${proto}"
  done
  ufw reload
else
  echo "ufw is not active: adding iptables rules (Oracle Ubuntu images use iptables + netfilter-persistent)"
  for r in "${RULES[@]}"; do
    read -r proto port _ <<<"$r"
    if ! iptables -C INPUT -p "$proto" -m state --state NEW -m "$proto" --dport "$port" -j ACCEPT 2>/dev/null; then
      # Insert at the top so the image's final REJECT rule cannot block it.
      iptables -I INPUT 1 -p "$proto" -m state --state NEW -m "$proto" --dport "$port" -j ACCEPT
      echo "  opened ${port}/${proto}"
    else
      echo "  already open ${port}/${proto}"
    fi
  done
  if command -v netfilter-persistent >/dev/null; then
    netfilter-persistent save
  else
    echo "Installing iptables-persistent so the rules survive a reboot…"
    DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
    netfilter-persistent save
  fi
fi

cat <<'TXT'

Server firewall done. Now the Oracle Cloud side (console, one time):
  Networking > Virtual cloud networks > <your VCN> > Security Lists > Default
  > Add Ingress Rules, Source CIDR 0.0.0.0/0, one rule per line:
    TCP  destination port 80
    TCP  destination port 443
    TCP  destination port 7881
    UDP  destination port 50000-60000
    UDP  destination port 3478
    TCP  destination port 5349
  (Leave the Source Port Range empty. Port 22 is already there.)
TXT
