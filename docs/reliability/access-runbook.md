# MathGPL access & reliability runbook

## 1. "This connection is not private" reported by a teacher

MathGPL's certificate is issued and auto-renewed by Google Trust Services through
Lovable hosting, and both `mathgpl.com` and `www.mathgpl.com` resolve to
`185.158.133.1`. When a warning appears, work through this order:

1. Open `https://mathgpl.com/status` from a different network (mobile data).
   Loading there means MathGPL itself is fine.
2. Ask the teacher for the certificate issuer shown in the warning. If it is a
   school/company name (FortiGuard, Zscaler, Sophos, Netskope, Cisco Umbrella),
   the local network is intercepting HTTPS and re-signing the connection. Only
   the school's IT team can allow the domain.
3. If the issuer is Google Trust Services and the warning mentions a date, the
   device clock is wrong — correct the date and time.
4. Only if the failure reproduces on multiple independent networks does it
   become a hosting issue: check Project settings → Domains for the domain
   status, then contact Lovable support with the domain name.

## 2. Domain classification / filtering

New domains are often unclassified and get blocked by school web filters.
Submit reclassification as an education site to:

- FortiGuard: https://www.fortiguard.com/faq/wfratingsubmit
- Zscaler: https://sitereview.zscaler.com/
- Cisco Talos: https://talosintelligence.com/reputation_center/support
- Symantec/Broadcom: https://sitereview.bluecoat.com/
- Palo Alto: https://urlfiltering.paloaltonetworks.com/
- Google Safe Browsing (if flagged): https://safebrowsing.google.com/safebrowsing/report_error/

Re-check quarterly and after any hosting change.

## 3. Certificate expiry

Certificates renew automatically. Keep an external monitor (UptimeRobot, Better
Stack or similar) watching `https://mathgpl.com/api/public/health` with SSL
expiry alerts at 30 and 14 days so renewal failures are never a surprise.

## 4. Uptime monitoring

`GET /api/public/health` returns JSON:

- `200` with `status: "healthy"` — everything reachable
- `200` with `status: "degraded"` — a non-critical service (media, AI) is slow or down
- `503` with `status: "critical"` — database or sign in unreachable; alert immediately

Recommended checks: every minute from at least two regions; alert after two
consecutive failures.

## 5. Teacher-facing incident wording

Never expose status codes, stack traces or service names. Use:

> MathGPL is temporarily busy. Your saved work is safe — please try again shortly.

Unsaved lesson-note changes are mirrored to the teacher's device
(`mathgpl.draft.<notebookId>` in local storage) and offered back on reopen, so a
failed save never destroys work.

## 6. Evidence commands for a reported privacy warning

Run these first — they settle in one step whether the problem is ours:

```bash
curl -sS -o /dev/null -w "%{http_code} %{ssl_verify_result}\n" https://mathgpl.com/
curl -sS -o /dev/null -w "%{http_code} %{ssl_verify_result}\n" https://www.mathgpl.com/
echo | openssl s_client -connect mathgpl.com:443 -servername mathgpl.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
getent hosts mathgpl.com www.mathgpl.com
```

Healthy baseline (confirmed 20 Aug 2026): `200 0` for the apex, `302 0` for
`www`, certificates issued by Google Trust Services (`CN=WE1`) covering each
name separately, both resolving to `185.158.133.1`.

If `ssl_verify_result` is `0` here but a device still warns, the interception is
on the client network — send the teacher to `/help/connection` and follow §1.
Only a non-zero verify result or a non-200/302 response makes it a hosting issue.
