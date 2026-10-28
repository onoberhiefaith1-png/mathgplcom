## Technical notes

Files: `src/pages/accounts/TeacherDashboard.tsx`, `src/components/workspace/WorkspaceLayout.tsx`, and one new `src/components/plans/CreditsBadge.tsx`. No routes, data hooks, entitlement logic or nav groups change; `workspaceNav.ts` keeps Plan, Pricing, Refer & Earn and MathGPL Live untouched.

**TeacherDashboard.**
- `QUICK` drops `/live` and `/teaching-hub/pricing`; the remaining five keep their `feature` keys and the `guard`/`Lock` fallback. The pill row becomes a card grid (`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5`) with each entry an icon + label tile in the existing `border-ws-border/70 bg-ws-canvas/40 rounded-2xl` language, so Quick Action reads as an action area rather than text links.
- `<ReferEarnCard />`, `<PlanSection />` and `<CreditsSection />` are removed from the page along with their imports.
- The three `rail` cards (My Schools, Manage Connections, My Students Overview) move into a new in-page `School & Students` section rendered last: a two-column grid holding the existing My Schools and My Students markup verbatim (same `switchTo` buttons, same student links, same empty notes), with the connection counts collapsed into one `Manage Connections` strip below linking to `/requests`. `WorkspaceInvitations` stays, rendered inside that section. With the rail empty, `rail` is dropped from the `WorkspaceLayout` call.
- The layout call adds `collapsibleNav` so the teacher gets the same open/close left column the student workspace now uses.

**Credits chip.** New `CreditsBadge`: reads the balance via the existing `fetchCreditActivity` server function (same call `CreditsSection` uses) plus the same `credit_wallets`/`credit_ledger` realtime channel, renders `<Coins /> {credits} credits` as a compact header pill, and on click opens a right-side sheet/drawer containing `<CreditsSection />` unchanged — so Add credits, usage toggle and activity all keep working. Loading and error states fall back to a neutral pill with no number.

**Header.** `WorkspaceLayout` renders `<CreditsBadge />` in the existing right-hand action cluster, before `<WorkspaceSwitcher compact />`, and only when `role !== "student"` so the earlier student decision holds.

Verification: `bunx tsgo --noEmit`, then an authenticated Playwright pass at 1280x1800 on `/teaching-hub` asserting the five section headings in order, exactly five Quick Action tiles with no MathGPL Live or Pricing, no Plan / Refer & Earn / Credits section text on the page, a header credits pill, and that clicking it reveals "Add credits".
