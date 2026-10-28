# Administrator-only referral links on the public MathGPL address

## What is true today

- The referral dashboard shows a link box, but the server always returns an empty URL (`link: { code, url: "" }`), so nothing usable is ever displayed — which is why the link people end up sharing is whatever address happens to be in their browser bar, including a preview address.
- Teachers, schools and platform admins all reach `/referral`, and the first visit silently creates a referral link for whoever opens the page.
- A public-site helper already exists and resolves to `https://mathgpl.com`, refusing preview/sandbox hosts. Referrals do not use it yet.
- Arrival capture already works: `?ref=CODE` is remembered in the visitor's browser, the click is recorded anonymously, and the code is attached to the account after registration.
- Referral attribution and school membership are already separate: joining a school still requires a school code. Nothing in the referral claim adds anyone to an organisation.

## What changes

1. **Only the administrator creates referral links.** Link creation moves behind an administrator check. Teachers, schools, parents and students never generate a link — they can only see and share a link the administrator created for them.
2. **Every link is a public MathGPL address.** The URL is built from the public site (`https://mathgpl.com/?ref=TOKEN`), never from the current browser host, so a copied link can never expose a preview or workspace address.
3. **Attribution records who referred.** Each link and attribution stores the referrer kind (administrator, school, teacher, parent, student) alongside the existing referrer id, org, referred user, status and registration date.
4. **Referral stays separate from membership.** Landing through a referral never grants school membership or any access to the referrer's workspace or dashboard.
