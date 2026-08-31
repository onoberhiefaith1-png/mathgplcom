## Behaviour by role

| Role | Create a link | See their link | Share it | See their referrals |
| --- | --- | --- | --- | --- |
| Administrator | Yes | Yes | Yes | All referrals, all sources |
| School / Teacher / Parent / Student | No | Only if the administrator issued one for them | Yes | Their own referrals only |

When no administrator-issued link exists, the Refer & Earn page and card say so plainly — no reward figure, no amount, no placeholder link, and no "create link" button.

## Technical notes

**Link URL.** Referral URLs are composed with the existing public-site helper (`publicOrigin()` / `PUBLIC_SITE`), which rejects localhost, preview and `*.lovable.app` hosts. Format: `https://mathgpl.com/?ref=TOKEN`. The dashboard's copy/share actions use that value instead of the current empty string.

**Link issuance.** `ensureLink` in `src/lib/referrals/referrals.server.ts` stops creating links for whoever opens the page. Instead:
- A new administrator action issues a link for a chosen referrer (existing campaign target search supplies the person or school).
- A non-administrator read returns only an existing link row; it never inserts one.
- Administrator gate reuses the existing `platform_owner` / `co_admin` role check already in that module.

**Attribution fields.** Staged additive migration adds `referrer_kind TEXT` to `referral_links` and `referral_attributions`, backfilled from each referrer's role, plus an index on `referral_attributions(referrer_kind)`. Existing columns (campaign, referrer user, org, referred user, status, registered/subscribed timestamps) are unchanged. These fields apply when the draft is accepted.

**Capture.** `src/lib/referrals/capture.ts` keeps its current behaviour: read `?ref=`, remember it, record an anonymous open, claim once on sign-in, then forget. Claiming continues to write only a referral attribution — never an `account_memberships` or class row — so school membership stays a separate school-code flow.

**Admin console.** `/admin/referrals` gains link management: issue a link for a target, view its token and public URL, copy it, deactivate it, and see which referrer each attribution belongs to.

**Not changed.** Campaign lifecycle (draft/live/paused/retired), reward rules, aggregation, top referrers, pending/settled rewards and mark-paid all stay as they are.

## Verification

1. As administrator: issue a link for a teacher and a school; both URLs begin `https://mathgpl.com/?ref=`.
2. Open a link in a clean browser; the visitor lands on the public homepage with no access prompt, and the click records anonymously.
3. Register from that visit; the attribution appears under the correct referrer with the correct referrer kind.
4. Confirm the newly registered account has no membership of the referrer's school and no access to the referrer's workspace.
5. As teacher and as school: no create-link control anywhere; an administrator-issued link is visible and copyable; without one, the page states no programme is running.
6. Typecheck plus the referral test suite.
