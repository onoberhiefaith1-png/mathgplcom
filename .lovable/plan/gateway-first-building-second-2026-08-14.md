# Gateway first, building second

Today a student tapping a school or teacher lands on the rotating building with a small "Choose your plan" box floating over it — and that box only lists paid plans, which is why your Free plan never appeared. The order gets reversed: the plan page comes first, the building comes after.

```text
My Teachers / My Schools
  -> PLAN PAGE (the owner's gateway, exactly as the teacher set it up)
       Free plan  -> Enter free
       Pro / Premium -> pay (Stripe) -> access granted
  -> BUILDING (owner's identity, one Enter button, nothing else)
  -> WORKSPACE DASHBOARD (classes, notes, adventure...)
```

## 1. Plan page becomes the first screen

`/student/teachers/:userId` and `/student/schools/:orgId` render the same plan layout the teacher sees under Pricing → Open gateway: one card per published plan, each listing what students get (Class Notes, Smartboard, Assessments, Assignment, Adventure, Gallery...), with the teacher's price and the monthly / yearly / one-time choice.

- **Free plan** — shown as a normal card with a "Enter free" action. Choosing it grants access immediately.
- **Paid plans** — open the teacher's Stripe checkout; access is granted when payment clears (unchanged logic).
- The owner's name and role ("Teacher workspace" / "School workspace") head the page, with a back link to the dashboard.
- If the owner published no plans at all, the student passes straight through to the building — nothing to choose.

## 2. Building stops carrying the gateway

The rotating building screen loses the "Choose your plan" panel entirely. It becomes what it was meant to be: the owner's identity plus a single **Enter** button. A student who has not yet cleared the plan page can't reach it — landing on the workspace URL shows the plan page until access exists.

## 3. One-to-one access after entry

Access continues to be recorded per workspace, and the plan chosen decides what opens inside — Class Notes, Assessments, Adventure and the rest are each checked against the plan snapshot taken at the moment of choosing. A student on Free who taps a Pro-only area still gets the existing upgrade prompt, which links back to this plan page. Nothing about the teacher's Pricing setup or the payment pipeline changes.

## Technical notes

- New `src/pages/student/WorkspacePlanGate.tsx`: reuses `useGatewayByHandle`, `useChoosePlan`, `usePlanCheckout`, `loadMyEntitlement` and `itemLabel`/`money` from the existing gateway modules — no new pricing logic. Resolves the owner's handle from `profiles.username` via `connectedOwner` / `connectedSchoolByOrg`.
- `src/pages/student/WorkspaceEntryPage.tsx`: the `blocked` state, `gateway` query and paid-plan panel are removed. It renders the plan gate when the student has no entitlement and the owner has plans; otherwise the building + `Enter`, which calls the existing `enter_workspace` RPC and navigates to the workspace dashboard.
- Free plan visibility bug: the old panel filtered to `price > 0`; the plan gate lists every published plan, so the Free tier appears.
- After a successful free choice or a returning paid `?checkout=success`, `enterWorkspace` runs once so `student_workspace_access` is recorded and the Learning lists refresh (`["student-learning"]` invalidation stays).
- Route `head()` metadata on both index routes updated to describe the plan step.
