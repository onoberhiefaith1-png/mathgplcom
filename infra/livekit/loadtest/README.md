# LiveKit load test: one teacher, up to 1,000 listeners

This folder answers one question: **how many students can listen to one
teacher on our own LiveKit server (Oracle Always Free A1: 4 OCPU, 24 GB,
arm64) before audio quality drops?**

| File | Where it runs | What it does |
|---|---|---|
| `run-load-test.sh` | **Client machine(s)**, never the server | Runs `lk load-test` in stages (default 100, 250, 500, 750, 1000 listeners) with 1 audio publisher, and saves each stage's output in `results/<time>-<host>-m<N>/` |
| `monitor-server.sh` | **On the LiveKit server** | Every 5 s writes CPU, memory, network out/in, and LiveKit's own metrics (participants, tracks, packet loss, jitter, retransmits, bytes out, goroutines) to a CSV |
| `summarise.py` | Anywhere (Python 3, no extra packages) | Combines the two into a per-stage table with PASS/WARN/FAIL and a final verdict |
| `test/check.sh` | Anywhere | bash syntax check, shellcheck (if installed), and summariser unit tests |

> **Honest note:** nobody knows the real maximum for this server until this
> test has been run on it. The figure under "Pre-run estimate" is an estimate
> only.

## 1. Install the LiveKit CLI (`lk`) on each client machine

Use a separate machine from the server: a laptop, a desktop, or a temporary
cloud VM. Linux or macOS:

```bash
curl -sSL https://get.livekit.io/cli | bash     # installs `lk`
lk --version                                   # tested with lk 2.19.4
```

(macOS with Homebrew: `brew install livekit-cli`. Windows: use WSL.)

Raise the open-file limit in the shell you test from. Each simulated listener
holds several sockets:

```bash
ulimit -n 65535     # if refused: add "* - nofile 65535" to /etc/security/limits.conf, log out and in
```

## 2. Run it

### On the server (keep this running for the whole test)

```bash
cd /opt/livekit/loadtest
./monitor-server.sh monitor.csv       # Ctrl+C when the clients are finished
```

It reads LiveKit's Prometheus metrics from `http://localhost:6789/metrics`
(enabled in `../livekit.yaml`). Prometheus is never opened in the firewall.

### On ONE client machine (simplest)

```bash
cd infra/livekit/loadtest
export LIVEKIT_URL=wss://livekit.<your-domain>
export LIVEKIT_API_KEY=<key>          # typed in the shell, never saved in a file
export LIVEKIT_API_SECRET=<secret>
./run-load-test.sh
```

Defaults: `STAGES="100 250 500 750 1000"`, `STAGE_DURATION=180` (seconds each
stage holds after everyone has joined), `JOIN_RATE=10` (joins per second),
`COOLDOWN=30`. Change any of them in front of the command, for example
`STAGES="100 250" STAGE_DURATION=60 ./run-load-test.sh`.

The publisher is `lk`'s simulated **audio-only** track (`--audio-publishers 1`,
no video publishers).

### Split across several client machines (recommended above ~250 listeners)

One laptop usually runs out of CPU before the server does. Every machine
runs the same command, with the same stages and the same `START_AT` (a shared
start time), and its own `MACHINE_INDEX`. Each machine runs its share of
every stage, and only machine 1 publishes the teacher track:

```bash
# pick a start a few minutes ahead, the same number on every machine:
date -d '+5 min' +%s        # macOS: date -v+5M +%s   → e.g. 1794420000

# machine 1
MACHINES=4 MACHINE_INDEX=1 START_AT=1794420000 ./run-load-test.sh
# machine 2
MACHINES=4 MACHINE_INDEX=2 START_AT=1794420000 ./run-load-test.sh
# … machines 3 and 4 the same with MACHINE_INDEX=3 and 4
```

With `STAGES="... 1000"` and `MACHINES=4`, each machine runs 250 listeners at
the last stage. All machines' clocks must be correct; `timedatectl` should
show "synchronized: yes".

The script refuses to run if `LIVEKIT_URL` points at the machine it is on,
because the load generator would steal the CPU being measured. (`ALLOW_LOCAL=1`
overrides this, for local smoke tests only.)

### Summarise

Copy every machine's `results/...` folder and the server's `monitor.csv` to
one place, then:

```bash
./summarise.py --monitor monitor.csv results/*-m1 results/*-m2 results/*-m3 results/*-m4
```

## 3. Reading the result

Example output (from the box smoke test below, **not** Oracle):

```
Listeners | OK/expected | CPU avg% | CPU peak% | Mem MB | Out Mbps | @48k Mbps | kbps/listener | Loss % | Jitter ms | Retx/s | Result
       20 |       20/20 |     13.2 |      21.2 |  10300 |     0.47 |       1.0 |          23.6 |   0.00 |       0.7 |    0.0 | PASS
       50 |       50/50 |      6.6 |      10.0 |  10062 |     1.32 |       2.5 |          26.3 |   0.00 |       0.3 |    0.0 | PASS
VERDICT: highest passing stage = 50 listeners ...
```

| Column | Meaning |
|---|---|
| OK/expected | Listeners that subscribed to the teacher track / listeners started. Any shortfall or client error is a **FAIL**. |
| CPU avg% / peak% | Whole-server CPU during the steady part of the stage (after everyone joined) |
| Mem MB | Peak memory used on the server |
| Out Mbps | What LiveKit sent during the stage (from its metrics; the network card's figure if those are missing) |
| @48k Mbps | What a **real** class would need: listeners × ~50 kbps (48 kbps Opus plus packet overhead). `lk`'s test track is only ~20 kbps, so "Out Mbps" is lower than real life. |
| Loss % | The worse of the server's figure (listeners' RTCP reports) and the clients' own count |
| Jitter ms | Average jitter the listeners reported to the server |
| Retx/s | Packets resent per second after NACKs (rising numbers mean listeners are missing packets) |

**Thresholds** (override with flags, e.g. `--cpu-warn 60`):

| | PASS | WARN | FAIL |
|---|---|---|---|
| CPU average | < 70% | 70–85% (or a peak ≥ 95%) | ≥ 85% |
| Packet loss | < 1% | 1–3% | ≥ 3% |
| Jitter | < 30 ms | 30–50 ms | ≥ 50 ms |
| Memory | < 80% | 80–90% | ≥ 90% |
| Listeners | all subscribed | – | any failed |

**Verdict:** the highest stage that passed with no FAIL below it, plus
headroom advice. Plan real classes at about **70%** of that number. If even
the top stage passed with low CPU, the server was not the limit. The verdict
then gives a straight-line guess for where CPU would reach 70%, which you
should confirm by running a higher stage (for example
`STAGES="1250 1500"`; see the track limit below).

## 4. Bandwidth math

- Speech in the app: 40–48 kbps Opus, about **50 kbps per listener** once
  packet headers are included.
- 1,000 listeners ≈ **50 Mbit/s** out from the server, about 23 GB per hour of
  lesson. The teacher's upload is just one stream (~50 kbps).
- Oracle A1 gives about 1 Gbit/s per OCPU (4 Gbit/s for 4 OCPU), and Always
  Free includes 10 TB out per month, so bandwidth is not expected to be the
  limit.
- CPU work depends mostly on **packets per second**. Opus sends 50 packets
  per second per listener whether it is 20 kbps or 48 kbps, so `lk`'s lighter
  test track still loads the CPU about the same as real speech.
- Client side: each simulated listener receives about 20–25 kbps, so 250
  listeners per client machine is only about 6 Mbit/s down. It is the client
  **CPU** that runs out first.

## 5. Pre-run estimate (ESTIMATE, not a measurement)

LiveKit's published benchmark ran 3,000 audio listeners (with 10 speakers) at
80% CPU on a 16-vCPU Google `c2-standard-16`. A 4-OCPU Ampere A1 has roughly
a third to half of that compute. Our case is lighter per listener (one
speaker), so:

- **1,000 listeners: expected to PASS**, at an estimated 30–60% CPU and about
  50 Mbit/s out.
- **Likely ceiling: about 1,500 listeners**, set first by LiveKit's default
  limit of 400 tracks per CPU (4 × 400 = 1,600 tracks, counting the teacher's
  incoming track and every listener's copy), possibly by CPU. Beyond that,
  `limit.num_tracks` in `../livekit.yaml` must be raised. Do that only if the
  CPU numbers in this test say there is room.
- The real figure is whatever this test reports.

The app creates class rooms for up to **1,001** people (one teacher and 1,000
listeners), changeable with the `CLASSROOM_AUDIO_MAX_PARTICIPANTS` secret. The
load test uses its own room, so it measures the server, not the app's limit.

## 6. Common reasons a stage fails (check these before blaming the server)

1. **Client machine saturated.** If the client's CPU is pegged, listeners
   join late, miss packets, or fail, and that is counted against the server.
   Watch `htop` on the client. If it is above ~80%, split the load over more
   machines (`MACHINES=…`).
2. **Client bandwidth or Wi-Fi.** Use wired or cloud machines for big stages.
3. **`ulimit` too low.** Errors like `too many open files` appear on the
   client (see step 1). The script warns when the limit looks too low.
4. **UDP blocked.** Ports 50000–60000/udp must be open in Oracle's Security
   List and the server firewall (`../firewall-setup.sh`). Without UDP,
   listeners fall back to TCP or TURN and loss and jitter rise.
5. **Track limit reached.** Above ~1,600 tracks LiveKit refuses new
   subscriptions (`limit.num_tracks`), which shows up as failed listeners.
6. **Joining too fast.** Hundreds of joins per second is not a realistic
   class. Keep `JOIN_RATE` around 10–20 per machine.
7. **Clocks out of sync.** The summariser matches client stages to server
   samples by time. A wrong clock gives "no server samples in this stage's
   window".

## 7. Box smoke test (proves the scripts; says nothing about Oracle)

The scripts were run end to end on an 8-vCPU x86 development box against a
local `livekit-server` v1.13.11, with `lk` 2.19.4, as two simulated client
machines (`MACHINES=2`). Stages were 20 and 50 listeners with 1 audio
publisher, 30 s each. All listeners subscribed, with 0% loss and jitter
around 0.3–0.7 ms. CPU figures there include the load generator on the same
machine, so they mean nothing for Oracle.

## 8. Checks

```bash
infra/livekit/loadtest/test/check.sh   # bash -n, shellcheck (if installed), summariser unit tests
```
