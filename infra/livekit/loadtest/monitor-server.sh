#!/usr/bin/env bash
# Run ON the LiveKit server during a load test. Samples every INTERVAL seconds:
# whole-machine CPU and memory, network throughput, and LiveKit's Prometheus
# metrics (participants, tracks, packet loss, jitter, retransmits, bytes out,
# goroutines, LiveKit's own CPU/memory) into one CSV. Stop with Ctrl+C.
#
#   ./monitor-server.sh                     # → monitor-<time>.csv
#   INTERVAL=5 METRICS_URL=http://localhost:6789/metrics IFACE=enp0s6 ./monitor-server.sh out.csv
#
# Needs only bash, awk, curl and /proc (no sar/ifstat required).
set -euo pipefail
INTERVAL=${INTERVAL:-5}
METRICS_URL=${METRICS_URL:-http://localhost:6789/metrics}
OUT=${1:-monitor-$(date -u +%Y%m%dT%H%M%SZ).csv}
IFACE=${IFACE:-$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<NF;i++) if($i=="dev"){print $(i+1); exit}}')}
[ -n "$IFACE" ] || IFACE=$(awk -F: 'NR>2{gsub(/ /,"",$1); if($1!="lo"){print $1; exit}}' /proc/net/dev)
NCPU=$(nproc)

cpu_sample() { awk '/^cpu /{idle=$5+$6; t=0; for(i=2;i<=NF;i++) t+=$i; print t, idle}' /proc/stat; }
net_sample() { awk -v d="$IFACE" -F'[: ]+' '{sub(/^ +/,"")} $1==d{print $2, $10}' /proc/net/dev; }
mem_sample() { awk '/^MemTotal:/{t=$2} /^MemAvailable:/{a=$2} END{printf "%.0f %.0f\n", (t-a)/1024, t/1024}' /proc/meminfo; }

# One line of LiveKit numbers (cumulative counters; differences are taken below).
lk_sample() {
  curl -fsS -m 3 "$METRICS_URL" 2>/dev/null | awk '
    /^#/ {next}
    { split($0, kv, " "); name=kv[1]; val=kv[2]+0; base=name; sub(/\{.*/, "", base) }
    base=="livekit_participant_total" {part+=val}
    base=="livekit_room_total" {rooms+=val}
    base=="livekit_track_subscribed_total" {subs+=val}
    base=="livekit_track_published_total" {pubs+=val}
    base=="go_goroutines" {gor=val}
    base=="process_cpu_seconds_total" {pcpu=val}
    base=="process_resident_memory_bytes" {rss=val}
    base=="livekit_packet_bytes" && name ~ /direction="outgoing"/ {bout+=val}
    base=="livekit_packet_total" && name ~ /direction="outgoing"/ && name ~ /transmission="initial"/ {pout+=val}
    base=="livekit_packet_total" && name ~ /direction="outgoing"/ && name ~ /transmission="retransmit"/ {retx+=val}
    base=="livekit_node_packet_total" && name ~ /type="dropped"/ {drop+=val}
    base=="livekit_packet_loss_percent_sum" && name ~ /direction="outgoing"/ {lsum+=val}
    base=="livekit_packet_loss_percent_count" && name ~ /direction="outgoing"/ {lcnt+=val}
    base=="livekit_jitter_us_sum" && name ~ /direction="outgoing"/ {jsum+=val}
    base=="livekit_jitter_us_count" && name ~ /direction="outgoing"/ {jcnt+=val}
    END { if (NR==0) {print "down"; exit}
          printf "up %d %d %d %d %d %.3f %.0f %.0f %.0f %.0f %.0f %.4f %.0f %.4f %.0f\n",
            part, rooms, subs, pubs, gor, pcpu, rss, bout, pout, retx, drop, lsum, lcnt, jsum, jcnt }'
}

echo "epoch,time_utc,cpu_pct,mem_used_mb,mem_total_mb,net_tx_mbps,net_rx_mbps,lk_up,participants,rooms,tracks_subscribed,tracks_published,goroutines,lk_cpu_pct,lk_rss_mb,lk_out_mbps,pkts_out_per_s,retransmits_per_s,dropped_per_s,loss_pct_out,jitter_ms_out" > "$OUT"
echo "Sampling every ${INTERVAL}s (interface $IFACE, $NCPU CPUs, metrics $METRICS_URL) → $OUT   Ctrl+C to stop"

read -r c_t0 c_i0 < <(cpu_sample)
read -r rx0 tx0 < <(net_sample || echo "0 0")
read -r -a lk0 < <(lk_sample || echo down)
t0=$(date +%s.%N)
trap 'echo; echo "Saved $OUT"; exit 0' INT TERM
while sleep "$INTERVAL"; do
  read -r c_t1 c_i1 < <(cpu_sample)
  read -r rx1 tx1 < <(net_sample || echo "0 0")
  read -r used total < <(mem_sample)
  read -r -a lk1 < <(lk_sample || echo down)
  t1=$(date +%s.%N); iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  awk -v t0="$t0" -v t1="$t1" -v iso="$iso" -v ct0="$c_t0" -v ci0="$c_i0" -v ct1="$c_t1" -v ci1="$c_i1" \
      -v rx0="$rx0" -v tx0="$tx0" -v rx1="$rx1" -v tx1="$tx1" -v used="$used" -v total="$total" -v ncpu="$NCPU" \
      -v a="${lk0[*]}" -v b="${lk1[*]}" 'BEGIN {
    dt = t1 - t0; if (dt <= 0) dt = 1
    dct = ct1 - ct0; cpu = dct > 0 ? 100 * (1 - (ci1 - ci0) / dct) : 0
    txm = (tx1 - tx0) * 8 / dt / 1e6; rxm = (rx1 - rx0) * 8 / dt / 1e6
    n = split(a, A, " "); m = split(b, B, " ")
    if (B[1] != "up" || A[1] != "up") {
      line = sprintf("0,,,,,,,,,,,,,")
    } else {
      lkcpu = 100 * (B[7] - A[7]) / dt / ncpu
      lkout = (B[9] - A[9]) * 8 / dt / 1e6
      pps = (B[10] - A[10]) / dt; rtx = (B[11] - A[11]) / dt; drp = (B[12] - A[12]) / dt
      dl = B[14] - A[14]; loss = dl > 0 ? (B[13] - A[13]) / dl : ""
      dj = B[16] - A[16]; jit = dj > 0 ? (B[15] - A[15]) / dj / 1000 : ""
      line = sprintf("1,%d,%d,%d,%d,%d,%.1f,%.0f,%.2f,%.0f,%.1f,%.1f,%s,%s", B[2], B[3], B[4], B[5], B[6], lkcpu, B[8] / 1048576, lkout, pps, rtx, drp,
                     loss == "" ? "" : sprintf("%.3f", loss), jit == "" ? "" : sprintf("%.2f", jit))
    }
    printf "%d,%s,%.1f,%d,%d,%.2f,%.2f,%s\n", t1, iso, cpu, used, total, txm, rxm, line
  }' >> "$OUT"
  tail -1 "$OUT" | awk -F, '{printf "\r%s cpu %5s%%  mem %6s MB  out %7s Mbps  people %5s  loss %6s%%  jitter %6s ms   ", $2, $3, $4, $6, $9, $20, $21}'
  c_t0=$c_t1; c_i0=$c_i1; rx0=$rx1; tx0=$tx1; lk0=("${lk1[@]}"); t0=$t1
done
