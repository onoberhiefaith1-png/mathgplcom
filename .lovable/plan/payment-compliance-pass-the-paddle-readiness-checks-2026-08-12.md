# Payment compliance: pass the Paddle readiness checks

Four checks are failing: Privacy Policy, Terms of Service, Refund Policy, Public Pricing. Everything below is presentation and policy content plus one gating fix on the pricing page. No changes to plan/credit/pricing logic, subscription logic, checkout, admin tools or any app feature.

## One thing I need from you

Paddle's account settings do not expose the legal seller name, so I cannot read it from the API. Before building I need:

1. The exact legal seller name (business name, or your own name if you sell as a sole proprietor) as configured in your Paddle account.
2. The support email address customers should use.

I will put those exact values on the Terms, Privacy, Refund and Support pages. I will not invent a name.

## 1. Public pricing (`/plans`)

Today the page derives an "audience" from the signed-in role, and everything on it is gated on that, so a logged-out visitor sees an empty page. The plan data itself is already public (`fetchPublishedPlans` has no auth middleware).

- When nobody is signed in, show a public pricing view: audience tabs (Teaching, School, Family) defaulting to Teaching, and every published visible plan for the chosen audience rendered from the live plan version — name, description, price and billing period, included credits, feature list, and whether it is Free or a subscription.
- Show the pay-as-you-go credit packs publicly too, priced from the current credit sell price (server function stays the same; it just needs to be callable without a session — if it requires auth, a small public read of the same pack data is added, still derived from the same sell price).
- Logged-out buttons: Create account / Log in on each plan, plus a note that checkout opens after sign-in. Subscribe / Choose plan / Buy credits stay exactly as they are once signed in.
- Add "Prices in GBP. Renews automatically until cancelled; cancel any time to stop future renewals" plus links to Terms, Privacy and Refund Policy directly under the plan grid and next to the Buy credits block.
- No account-specific data (wallet balance, current plan) renders when logged out.

This keeps a single source of truth: the same published plan versions and the same credit sell price feed public pricing, authenticated pricing and checkout. Existing subscriptions keep their locked version — unchanged.

## 2. Credit packs

The pack list lives in the `credit_packages` table and prices are already computed as credits x current sell price. Align the active pack set with 10 / 20 / 50 / 100 / 200 / 400 / 1,000 credits (data-only change to that table; no pricing logic touched, no historical purchase repriced). One-year validity wording surfaced on the pricing page.

## 3. Privacy Policy (`/privacy`)

Rewrite with the full structure Paddle expects: who operates MathGPL and the legal seller entity; what MathGPL provides; each category of personal data collected and why (account, role, school/class, learning and assessment records, usage, subscription/payment records, support messages, technical/device data) with an explicit statement that MathGPL does not store full card details; purposes; legal bases (contract, legitimate interests, consent, legal obligation); a Paddle section stating Paddle is Merchant of Record and receives the transaction data needed for payments, subscriptions, refunds and tax; processors and infrastructure providers; retention and deletion, including records kept for accounting and fraud prevention; security measures in reasonable terms; data rights (access, correction, deletion, restriction, objection, portability, withdrawal of consent) and how to exercise them; contact method; effective and last-updated dates.

## 4. Terms of Service (`/terms`)

Rewrite covering: legal seller identification with the MathGPL brand; description of the platform; the four account types and that features differ by type and plan; free and paid plans; what a paid subscription grants at time of purchase; credits, how they are consumed, that balances and credit pricing are shown before purchase, and expiry where stated; pay-as-you-go credit purchases; that price changes apply to future purchases only and an existing subscription keeps its purchased terms until it expires or renews; automatic renewal and how to cancel; that cancellation stops future renewal while access runs to the end of the paid period; acceptable use and the full prohibited list (illegal activity, fraud, abuse, unauthorised access, bypassing subscription or credit limits, AI misuse, redistributing paid content, prohibited account sharing, interfering with security); IP ownership and the limited user licence, plus community-asset permissions; teacher- and student-created content; no guarantee of educational outcomes; availability disclaimer; suspension and termination; limitation of liability preserving non-excludable rights; complaints and support; the Paddle Merchant of Record statement in its own clearly visible section, worded as Paddle requires; links to Privacy, Refund Policy, Pricing and Support; effective and last-updated dates.

## 5. Refund Policy (new page at `/refund-policy`)

New public page following your structure exactly: digital-services framing; subscriptions (cancel stops renewal, current period not automatically refunded); credits (usage taken into account, unused eligible credits may qualify for a full or partial refund subject to Paddle's rules, law, expiry and transaction type; used credits not refundable on change of mind); technical problems route through support first; statutory rights preserved for UK/EU/EEA and elsewhere; Paddle refunds section stating refunds are processed through Paddle and not paid directly by MathGPL; what a refund request should include. States a 30-day window for change-of-mind requests on eligible purchases so the check has a concrete period. No "all sales final" language, no promise of automatic refunds.

## 6. Support page (new page at `/support`)

Official support contact, what to contact MathGPL about (accounts, platform, technical), and a payments section explaining Paddle is Merchant of Record and handles payment support and refunds, with a link to Paddle's buyer support (paddle.net).

## 7. Footer and checkout links

Add a shared footer component with Pricing, Terms, Privacy, Refund Policy, Support and the Merchant of Record line, placed on the public-facing pages (home, pricing, and the four policy/support pages). The same three policy links appear beside the checkout entry points on the pricing page.

## 8. Verification

All six pages fetched logged out to confirm they render real content with no auth redirect, then the Paddle readiness check re-run. I will report the actual check result — not a claim that it passed.

## Technical notes

- New routes `src/routes/refund-policy/index.tsx` and `src/routes/support/index.tsx` with their own head metadata; pages under `src/pages/legal/`.
- `PlansPage.tsx` splits into a public pricing view and the existing signed-in plan view; no server function contracts change apart from making pack pricing readable without a session.
- Credit pack set is a data change in `credit_packages`; `sellPrice.ts`, `plans.server.ts`, `catalogSync.server.ts` and the webhook path are untouched.
