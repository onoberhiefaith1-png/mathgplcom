# Self-hosted LiveKit for Mathemagine classroom audio

This folder runs your own LiveKit server, so classroom voice no longer uses
LiveKit Cloud and its minute limits. It is one small Linux server with:

| Service | What it does |
|---|---|
| `livekit` (livekit-server) | The media relay (SFU) plus the built-in TURN server |
| `caddy` (livekit/caddyl4) | Gets free TLS certificates automatically and shares port 443 between signalling and TURN/TLS |
| `redis` | Local-only state that LiveKit and egress share |
| `egress` (optional) | Records the teacher's microphone as audio-only `.ogg` files into an S3-compatible bucket (Cloudflare R2 or Supabase Storage) |

Files:

| File | Purpose |
|---|---|
| `docker-compose.yaml` | The four services above (egress only with `--profile recording`) |
| `livekit.yaml` | LiveKit config template (TURN, ports, external IP, Prometheus) |
| `egress.yaml` | Recording config template (bucket) |
| `caddy.yaml` | Caddy config template (TLS + port 443 split). It is YAML rather than a Caddyfile because TURN/TLS and the signalling site share port 443, which needs Caddy's layer4 plugin. This is LiveKit's own recommended layout. |
| `redis.conf` | Redis, bound to localhost only |
| `.env.example` | Every setting and secret, placeholders only. You copy it to `.env` on the server. |
| `render-config.sh` | Fills the templates from `.env` into `generated/` |
| `firewall-setup.sh` | Opens the ports on the Ubuntu firewall and prints the Oracle console rules |

Secrets live only in `.env` on the server. `.env` and `generated/` are git-ignored.

---

## 0. What you need

- A domain you control (for example `mathgpl.com`). You will add two names:
  `livekit.mathgpl.com` and `turn.mathgpl.com`.
- An Oracle Cloud account (Always Free), or any Ubuntu server with a public IP
  (see "Fallback" for Hetzner).
- About an hour for the first setup.

## 1. Create the server (Oracle Always Free, ARM)

1. Oracle Cloud console, **Compute > Instances > Create instance**.
2. **Image:** Canonical Ubuntu 24.04 (pick the **aarch64** build).
3. **Shape:** Ampere **VM.Standard.A1.Flex**, **4 OCPU, 24 GB memory**. That is
   the whole Always Free ARM allowance. Every image used here (livekit-server,
   egress, caddyl4, redis) has an arm64 build.
4. **Networking:** keep "Assign a public IPv4 address" on.
5. **SSH keys:** upload your public key, or download the generated private key
   and keep it safe.
6. Create the instance. If you see **"Out of host capacity"**, try another
   Availability Domain or try again later. Upgrading the account to
   Pay-As-You-Go usually fixes it, and Always Free resources stay free.
7. Make the IP permanent: **Instance > Attached VNICs > IPv4 addresses >
   Ephemeral public IP > Edit > Reserved public IP**. Otherwise the IP can
   change and your DNS would point nowhere.
8. Log in: `ssh ubuntu@<PUBLIC_IP>`

## 2. Open the ports (two firewalls on Oracle)

Oracle blocks traffic in **two** places, and both must allow these ports:

| Port | Protocol | Why |
|---|---|---|
| 80 | TCP | Let's Encrypt certificate check |
| 443 | TCP | Secure signalling (wss) and TURN/TLS |
| 7881 | TCP | WebRTC over TCP when UDP is blocked |
| 50000-60000 | UDP | WebRTC media (normal path) |
| 3478 | UDP | TURN/UDP |
| 5349 | TCP | TURN/TCP (optional; TURN/TLS already goes through 443) |

**a) Oracle console Security List.** Go to **Networking > Virtual cloud
networks > (your VCN) > Security Lists > Default Security List > Add Ingress
Rules**. Add one rule per row in the table above. For each rule use Source
CIDR `0.0.0.0/0`, leave Source Port Range empty, and set the Destination Port
Range to the port (for example `50000-60000`) and the protocol as listed.

**b) The server's own firewall.** On the server:

```bash
sudo ./firewall-setup.sh
```

The script uses `ufw` if it is active. Otherwise it uses Oracle's default
`iptables` rules, inserting the ports above the image's final REJECT rule, and
saves them so they survive a reboot. It always keeps SSH (22) open.

## 3. DNS records (no Cloudflare proxy)

At your DNS provider add:

| Type | Name | Value | Proxy |
|---|---|---|---|
| A | `livekit` | `<PUBLIC_IP>` | **DNS only** (grey cloud) |
| A | `turn` | `<PUBLIC_IP>` | **DNS only** (grey cloud) |

Use a short TTL (300 seconds) so a later move is quick.

**Do not proxy these through Cloudflare (orange cloud).** Cloudflare's proxy
only carries web traffic. It breaks WebRTC UDP, TURN, and port 7881, and it
interferes with certificate issuance.

Check from your own computer (both should print the server IP):

```bash
dig +short livekit.mathgpl.com
dig +short turn.mathgpl.com
```

## 4. Install

On the server:

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# This folder → /opt/livekit
sudo mkdir -p /opt/livekit && sudo chown $USER /opt/livekit
git clone --depth 1 https://github.com/onoberhiefaith1-png/mathgplcom.git /tmp/mathgplcom
cp -r /tmp/mathgplcom/infra/livekit/. /opt/livekit/ && rm -rf /tmp/mathgplcom
cd /opt/livekit
```

(If the repository is private, copy the folder up with `scp -r infra/livekit ubuntu@<PUBLIC_IP>:/opt/` instead.)

### Make the API key

```bash
docker run --rm livekit/livekit-server:v1.13.11 generate-keys
```

This prints an `API Key` (starts with `API`) and an `API Secret`. They are the
password to your server: keep them in a password manager and never paste them
into chat or git.

### Settings

```bash
cp .env.example .env
chmod 600 .env
nano .env        # set LK_DOMAIN, LK_TURN_DOMAIN, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
./render-config.sh
docker compose up -d
docker compose logs -f caddy livekit     # Ctrl+C to stop watching
```

Within a minute Caddy should log `certificate obtained successfully` for both
names. Then check from your computer:

```bash
curl https://livekit.mathgpl.com      # prints: OK
```

Make it start on boot. `restart: unless-stopped` already brings the
containers back after a reboot as long as Docker itself starts:

```bash
sudo systemctl enable docker
```

## 5. Switch the app over

The classroom audio tokens are made by the app's own server route
(`/api/classroom-audio/token`, in `src/lib/classroomAudio/token.server.ts`).
That route reads its LiveKit settings from the app's secrets, which are set in
the **Lovable project's Secrets**. There is no Supabase edge function for
LiveKit, and no Supabase secret needs to change.

Add these three secrets (your values):

| Secret | Value |
|---|---|
| `LIVEKIT_SELF_HOSTED_URL` | `wss://livekit.mathgpl.com` (must start with `wss://`) |
| `LIVEKIT_SELF_HOSTED_API_KEY` | the API Key from step 4 |
| `LIVEKIT_SELF_HOSTED_API_SECRET` | the API Secret from step 4 |

Then flip the switch:

| Secret | Value |
|---|---|
| `LIVEKIT_TARGET` | `self-hosted` |

Your existing LiveKit Cloud secrets (`LIVEKIT_URL` / `LIVEKIT_API_KEY` /
`LIVEKIT_API_SECRET`, or the older `LIVEKITWebsocketURL` / `LIVEKITAPIKEY` /
`LIVEKITAPIsecret`) stay where they are. To go back to Cloud at any time, set
`LIVEKIT_TARGET` to `cloud` (or delete it). If `LIVEKIT_TARGET` holds any
other value, or the self-hosted secrets are missing, the Smartboard shows
"Audio connection not set" rather than silently using the wrong server.

This switch ships with this change, so the app must be published once with
it. If audio still reaches Cloud after you change the secret, publish the app
again so the server picks up the new value.

**Test:** open a class Smartboard as the teacher on one device and as a
student on another. The teacher speaks and the student hears. A student
cannot speak until the teacher passes them the floor.

## 6. Optional: recording (audio only)

The egress service records **only the teacher's microphone track** (Track
Egress). It copies the Opus audio straight into an `.ogg` file, with no video
and no Chrome, so it is light enough for this server.

1. Make a bucket and S3 keys:
   - **Cloudflare R2:** R2 > Create bucket (for example
     `mathemagine-recordings`) > Manage R2 API Tokens > Create token with
     "Object Read & Write" on that bucket. Endpoint
     `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`.
   - **Supabase Storage:** Storage > create a private bucket, then Project
     Settings > Storage > S3 Connection > New access key. Endpoint
     `https://<PROJECT_REF>.supabase.co/storage/v1/s3`, region as shown there.
2. Fill the `EGRESS_S3_*` lines in `.env`, then:
   ```bash
   ./render-config.sh
   docker compose --profile recording up -d
   ```
3. In the app's secrets set `LIVEKIT_RECORDING_ENABLED` = `true`.
4. The teacher (only the class owner) can then call
   `POST /api/classroom-audio/recording` with
   `{ "classId": "<class id>", "command": "start" }`, and later
   `"command": "stop"`. Files land at
   `classroom-audio/<room>/<time>.ogg`. There is no Smartboard button for this
   yet; it is a hook for a later UI.
   This hook expects the self-hosted egress with its bucket in `egress.yaml`.
   LiveKit Cloud would need storage settings sent with each request.

Each recording stops by itself after 3 hours (`session_limits`).

## 7. Load test: 1 teacher + 1,000 listeners

**The full stepped test with a server monitor and a PASS/WARN/FAIL verdict is in
[`loadtest/`](loadtest/README.md).** The single command below is the quick version.

Run this from **other machines, not the server itself**: the test clients use
CPU and bandwidth too. Install the LiveKit CLI:

```bash
curl -sSL https://get.livekit.io/cli | bash
```

One machine (start gently: 10 joins per second):

```bash
lk load-test \
  --url wss://livekit.mathgpl.com \
  --api-key <API_KEY> --api-secret <API_SECRET> \
  --room load-test \
  --audio-publishers 1 \
  --subscribers 1000 \
  --num-per-second 10 \
  --duration 5m
```

1,000 simulated listeners is a lot for one laptop. Spread them over 4 machines
(or cloud shells) with `--subscribers 250`, the same `--room`, a different
`--identity-prefix` on each, and `--audio-publishers 1` on only one of them.

While it runs, watch the server (`htop`, `docker stats`) and the metrics below.
The CLI prints each tester's packet loss and latency at the end.

Rough numbers to expect:
- Speech is about 40 kbit/s (the app's "clear" setting), roughly 50 kbit/s with
  overhead. 1,000 listeners is about **50 Mbit/s** out, about **23 GB per
  hour**. Oracle Always Free includes 10 TB of outbound data per month.
- By default LiveKit allows 400 tracks per CPU. 4 OCPUs give 1,600, which is
  enough for 1,000 listeners. On a smaller server, raise `limit.num_tracks` in
  `livekit.yaml` only after a successful test.
- Today the app creates class rooms capped at **21 people**
  (`CLASSROOM_AUDIO_MAX_PARTICIPANTS`). The 1,000 test is a capacity check for
  the server, not a change to class size. `load-test` makes its own room
  without that cap.

## 8. Monitoring

LiveKit exposes Prometheus metrics on port **6789**, and egress on **6790**.
Neither is open to the internet. View them through SSH from your computer:

```bash
ssh -L 6789:localhost:6789 ubuntu@<PUBLIC_IP>
# then in another terminal or a browser:
curl http://localhost:6789/metrics | grep '^livekit_' | head
```

Point a Prometheus/Grafana setup (or Grafana Cloud's free tier, through an
agent on the server) at `localhost:6789` to graph rooms, participants, packet
loss and bandwidth. Quick checks without that:

```bash
docker compose ps                      # all "running"
docker compose logs --since 10m livekit
docker stats                           # CPU / memory per service
```

Oracle can reclaim Always Free instances that stay **idle** (very low CPU,
network and memory use over 7 days). A server that only works during lessons
can look idle. Upgrading the account to Pay-As-You-Go avoids this, and Always
Free resources still cost nothing.

## 9. Updates

Versions are pinned in `docker-compose.yaml`. To update, outside lesson time:

1. Check the LiveKit release notes (github.com/livekit/livekit/releases).
2. Change the image tag (for example `livekit/livekit-server:v1.13.11` to the
   new version).
3. Run:
   ```bash
   docker compose pull
   docker compose up -d          # add --profile recording if you use egress
   ```
4. Run `curl https://livekit.mathgpl.com` (prints `OK`), then test a class.

After any change to `.env` or a template, run `./render-config.sh && docker compose up -d`.

Ubuntu security updates: `sudo apt update && sudo apt upgrade -y`, then reboot
outside lesson time.

## 10. Backup and fallback

Nothing in LiveKit needs a database backup. Rooms live only while a class is
on. What to keep:
- `.env`, saved in your password manager. It is the only thing you cannot
  recreate.
- `caddy_data/` holds the certificates. It is fine to lose: Caddy fetches new
  ones, but Let's Encrypt limits how often (see Gotchas).

**Instant fallback, LiveKit Cloud:** set the app secret `LIVEKIT_TARGET` to
`cloud`. The Cloud secrets are still there, so classes go back to Cloud on
their next join.

**Move to Hetzner** (if Oracle is unavailable). A Hetzner Cloud ARM server
(CAX11 or CAX21, Ubuntu 24.04) costs a few euros a month and includes 20 TB
of traffic.
1. Create it. Hetzner's Cloud Firewall (if you use one) needs the same port
   table as step 2. On the server run `sudo ufw allow OpenSSH && sudo ufw enable && sudo ./firewall-setup.sh`.
2. Do steps 4 and 6 with the **same `.env`**.
3. Change both DNS A records to the new IP and wait for the TTL (5 minutes).
4. Nothing changes in the app: the URL and keys are the same.

## 11. Common gotchas

- **Cloudflare orange cloud:** must be grey (DNS only) on both names.
- **Only one firewall opened:** Oracle needs the console Security List **and**
  the server's iptables or ufw.
- **No certificate:** port 80 is closed, DNS is not pointing at the server
  yet, or the names are proxied. Caddy keeps retrying; check
  `docker compose logs caddy`. Let's Encrypt allows only about 5 failed
  attempts per hour per name, so fix DNS first.
- **Connects, but no sound for some users:** UDP 50000-60000 is blocked
  somewhere. LiveKit then falls back to TCP 7881 and TURN/TLS on 443, so
  check those are open too.
- **Wrong public IP announced:** `use_external_ip: true` discovers it through
  STUN. If logs show a private `10.x` IP as the node IP and remote users fail,
  set `rtc.node_ip: <PUBLIC_IP>` and `use_external_ip: false`.
- **TURN check:** in Chrome open `chrome://webrtc-internals` during a class.
  A working TURN path shows a `relay` candidate on `turn.<domain>`. Test it
  once from a strict network (a school or office Wi-Fi, or a phone hotspot
  with a VPN).
- **`wss://` only:** the app refuses a LiveKit URL that is not `wss://...`.
  Use `wss://livekit.<domain>`, not `https://`, an IP address, or `:7880`.
- **Same name twice:** `LK_DOMAIN` and `LK_TURN_DOMAIN` must be different.
- **Secret too short:** LiveKit wants at least 32 characters
  (`render-config.sh` checks this).
- **Changed `.env` but nothing happened:** run `./render-config.sh && docker compose up -d`.
- **Host networking:** this compose uses `network_mode: host`, so it runs on
  Linux only (not Docker Desktop on Mac or Windows), and Docker does not
  bypass the firewall rules you set.
- **Clock:** tokens are time-limited. Ubuntu keeps time with
  `systemd-timesyncd`; `timedatectl` should show "synchronized: yes".
