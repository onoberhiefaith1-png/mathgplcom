# Give your own accounts unlimited AI generation

## What is actually happening

Your four test accounts (school, teacher, parent, student) are already registered as test accounts and are never metered. Your **own owner account is not** — it is treated as a normal paying customer, and its credit wallet in this app holds **0 credits**. That is why generation stops with "out of credits": the 700+ credits you are looking at are not in this account's app wallet.

So the block is not a bug in the generator — the owner account was simply never included in the free-access rule.

## The fix

1. **Owner and co-admin accounts are never metered.** Any account holding the `platform_owner` or `co_admin` role is treated exactly like a test account: no credit check, no wallet requirement, no AI-plan requirement, no plan caps. This covers your personal account on every path — lesson notes, solutions, floating numbers, smartboard, covers, geometry, assessments — because they all go through the same credit gate.

2. **Accounts you own stay unlimited.** Your school, teacher, parent and student accounts keep their existing free access; nothing changes for them.

3. **Everybody else is unaffected.** Ordinary schools, teachers and parents keep the current behaviour: credits are reserved before generation, the start/stop floors apply, and paid-plan rules stand.

4. **Honest message when a block does happen.** When an account really is out of credits the message stays as it is; what disappears is the case where an unmetered account is told it has no credits.

## Technical notes

- One additive migration replacing `public.has_free_access(_user_id)` so it also returns true when `has_role(_user_id,'platform_owner')` or `has_role(_user_id,'co_admin')`. Every downstream gate already funnels through it:
  - `credit_headroom` returns `enforced = false` → `reserve_credits` returns `ok, 'unmetered'`,
  - `plan_allows_ai` and `has_entitlement` already short-circuit on it,
  - `effective_limit` already returns `NULL` (uncapped) for free-access accounts, so class/student caps also lift.
- No table, grant, RLS or client change required; `withCredits`, `supabase/functions/_shared/creditGate.ts` and `creditGuard.ts` all read those functions.
- Optional follow-up if you want a real balance on your owner account instead: grant credits to cost unit `CU-000001` from the admin credit screen. Say the word and I will add that instead of, or alongside, the rule above.
