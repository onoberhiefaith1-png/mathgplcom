# Student journey: Connections, Workspace Identity, Class

Three clear levels replace today's flat student dashboard. Nothing about teacher, school or class tooling changes — only how a student reaches it and when it becomes active.

```text
LEVEL 1  Student Dashboard (/student)
         CONNECTIONS : My Schools, My Teachers
         LEARNING    : My Classes, Assignments, Adventure, Skill Builder, Join Class
LEVEL 2  Workspace identity
         My Schools  -> ABC School  -> ABC School building -> School Dashboard
         My Teachers -> Mr John     -> Mr John's building  -> Teacher Dashboard
LEVEL 3  Class workspace (unchanged)
         Notes, Smartboard, Assignments, Adventure, Skill Builder, Assessments, Progress
```

## 1. The dashboard becomes two layers

`/student` is rebuilt as two labelled blocks:

- **Connections** (top): My Schools and My Teachers, drawn from accepted connections. A newly accepted connection appears here immediately.
- **Learning** (below): My Classes, Assignments, Adventure, Skill Builder, Join Class — an aggregation across every workspace the student has *entered*, each row tagged with its school or teacher.

School/teacher management-style rail cards are removed from the student view.

## 2. Entering a workspace

Tapping a school or teacher in Connections opens that owner's identity screen: their building fills the screen with the owner's name and one **Enter** action. The teacher's own customised building is used for a teacher; the school's building for a school.

Pressing Enter runs the gateway:

- **No published paid plans** — access is granted immediately and the owner's dashboard opens.
- **Paid plans published, not yet paid** — the building stays on screen with a "Choose your plan" panel listing that owner's published plans (one-time / monthly / yearly, using the existing pricing gateway). Classes stay hidden until payment clears.

Once inside, the school dashboard shows that school's classes, its teachers and **Join Class** (scoped to this school). The teacher dashboard shows that teacher's classes and Join Class for their classes. Both are read/play only, as today.

## 3. Learning activates only after entry

A student who is connected but has never entered sees the school in My Schools and nothing new under Learning. After a successful entry, that workspace's classes, assignments, adventures and skill builders flow into the global Learning lists.

This applies to everyone, including students already enrolled today: each of their schools and teachers must be opened once. My Classes shows a short "Open ABC School to activate" prompt whenever a connection has content waiting behind an un-entered gateway, so nobody is left guessing.

Entering through My Classes shows classes directly — no building step — and all routes land on the same class workspace with the same progress. No duplicated classes or progress.

## 4. Technical notes

**Database (additive migration)**

- New table `student_workspace_access`: `student_id`, `owner_id` (the teacher or school account), `org_id` (null for a teacher), `granted_at`, `source` (`open` | `paid`), unique on (student, owner). GRANTs for `authenticated` + `service_role`; RLS so a student reads and inserts only their own rows, and the owner may read rows naming them.
- A `security definer` function `enter_workspace(_owner_id uuid)` that verifies an accepted connection, checks whether the owner has published paid plans, and either records access or returns `payment_required`. The Stripe webhook path already grants `gateway_entitlements`; it also records access on success.

**Frontend**

- `src/lib/student/workspaceAccess.ts`: reads the student's granted workspaces and exposes `enterWorkspace`.
- `src/lib/student/allClasses.ts`: `myClasses()` additionally filters class rows to those whose `org_id` / `owner_id` appears in the granted set, so every downstream list (assignments, adventures, skill builders, progress) inherits the rule with no other change.
- New routes `src/routes/student/schools/$orgId/index.tsx` and `src/routes/student/teachers/$userId/index.tsx` (building identity + Enter + plan panel), plus `.../dashboard` leaves for the school/teacher class lists. Each gets its own `head()` metadata.
- New components under `src/components/student/`: `WorkspaceIdentityScreen`, `WorkspaceGatewayPanel`, `ConnectionsSection`, `LearningSection`.
- Reuses `RotatingAdventureScene`, `useBuildingContext` (owner-scoped, `school-readonly` mode), `loadGatewayByHandle`, `loadMyEntitlement`, `GatewayGate` and the existing Join Class panel. No pricing, payment or class logic is rewritten.

## Suggested delivery

Migration + access helper and the two-layer dashboard first, then the school/teacher identity screens and gateway panel, then the activation prompts in My Classes.
