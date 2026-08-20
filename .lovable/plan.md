# Diagnosis: the "Connection Is Not Private" warning on mathgpl.com

## What the checks show

From outside your network, mathgpl.com is healthy:

- `https://mathgpl.com` returns 200 with a fully valid certificate (issuer: Google Trust Services, valid 8 Aug 2026 → 6 Nov 2026, covers `mathgpl.com`).
- `https://www.mathgpl.com` has its own valid certificate covering `www.mathgpl.com`, and redirects to the main domain.
- Both names resolve to the same hosting address, and the domain is in the `connected` state (12 days stable).
- Certificate verification result from an independent client: 0 (no error).

So the certificate, DNS and hosting are all correct. The warning is not coming from the site.

## What is actually happening

The second screenshot is the giveaway: the phone's browser suggests **"Web Filter Violation — mathgpl.com"**, alongside identity-verification and filtering entries. That means the phone is on a network (or has a profile/VPN/parental-filter installed) that runs an **SSL-inspecting web filter**. The filter terminates the TLS connection, re-signs it with its own certificate, and the phone reports it as "this website may be impersonating mathgpl.com". Chrome and Safari both show that as a privacy warning.

This is a device/network trust issue, not a MathGPL defect. Confirmation test: open the same URL on mobile data with Wi-Fi off — the warning will not appear.

## Proposed work (optional, app-side)

Nothing needs fixing in the certificate or DNS. What we can add is user-facing help so a teacher who hits this understands it in seconds instead of distrusting the product:

1. **A public trust/help page** at `/help/connection` explaining the warning in plain language: what an inspecting web filter is, how to confirm it (switch to mobile data), and what to ask a school IT admin to do (allow `mathgpl.com` and `*.mathgpl.com` through the filter without SSL inspection).
2. **Link it from the status page** (`/status`) so the existing reliability surface points at it.
3. **Extend the existing access runbook** (`docs/reliability/access-runbook.md`) with the exact evidence commands used here, so this is diagnosed in one step next time rather than re-investigated.

## Technical notes

- No certificate, DNS or hosting change is required or possible from our side — the interception happens on the client network.
- New route: `src/routes/help/connection.tsx` (public, SSR, own `head()` metadata), with a small link added to `src/pages/StatusPage.tsx`.
- No database or auth changes.
