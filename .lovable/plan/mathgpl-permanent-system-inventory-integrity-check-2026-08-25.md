# MathGPL Permanent System Inventory & Integrity Check

This is Phase 1 of a multi-phase build. Phase 1 is audit, reconstruction and
documentation only — no feature is redesigned, removed or "cleaned up".

## What Phase 1 produces

1. **A machine-readable Permanent Standard**, not just prose.
   Each requirement is one record with: ID, name, category, source (the
   discussion/decision it came from), approved requirement, expected behaviour,
   expected UI, expected data, expected permissions, implementation map
   (files/components/functions/routes/tables/policies), dependencies,
   validation method, restoration source, current status
   (PASS/PARTIAL/FAIL/MISSING/UNKNOWN), permanent status
   (PENDING/APPROVED PERMANENT/CHANGED/RETIRED), notes.

2. **A human-readable master inventory** with Sections A–J exactly as specified
   (system map, historical summary, checklist, implementation map, current
   status, known regressions, restoration sources, dependencies, validation
   tests, future check-system architecture).

3. **A dedicated 2D / Area regression report** answering all 15 questions asked,
   documenting the deviation without patching it.

Anything that cannot be evidenced from project history or current code is
recorded as `UNKNOWN — REQUIRES HUMAN CONFIRMATION`. No requirement is invented.

## Where it lives

```text
docs/system-standard/
  README.md                     how the standard works, ID scheme, rules
  INVENTORY.md                  Sections A–J master document
  regressions/2d-area.md        the 2D/Area regression report
  requirements/<domain>.ts      typed requirement records (source of truth)
  index.ts                      registry that loads every domain
```

Requirement records are TypeScript so the future CHECK SYSTEM screen can import
them directly and so typos break the build. They contain no runtime logic.

## Domain coverage (discovered from the codebase, not assumed)

Phase 1 walks the whole tree and produces one requirements file per domain.
Current discovered domains, each broken into small numbered segments:

Platform core & routing · Authentication · Accounts & roles · Workspaces &
tenancy · Rotating Building + Building Settings · Homepage/website CMS ·
Teaching Hub & Classes · Lesson Notes (editor, sections, sensors, archive,
dustbin) · Assets & GPL Asset Library · Math structures (fraction, root,
exponent, matrix, summation) · Tables (Smart Table, table activity, branch
numbering) · Charts (bar, histogram, pie, trend, progress) · 2D Geometry ·
Geometry Properties & Relationships · Area · 3D Geometry · Diagrams
(persistence, zoom, positioning) · Smartboard (Board A, Board B, presentation,
notes reveal) · Floating Numbers (highlighting, preparation, generating,
evaluation) · Check Line & marking · Assignments · Assessment · Adventure
(groups, timer, progress bar, video timer, rewards, gallery) · Courses ·
MathGPL Live & Smart Cards · Community · Reports & progress calculation ·
Credits, plans, payments, gateways · Admin console · Stability & reliability ·
AI layers (Co-Pilot, Math Engine, notebook-ai standards, integrity/QUESTION_LOCK).

Each domain file ends with an explicit `coverage` note stating what was
inspected and what remains UNKNOWN, so gaps are visible rather than implied.

## How history is reconstructed

For every domain: search the project chat history for the decisions that created
or changed it, read the archived plans in `.lovable/plan/` and
`.lovable/plan-*.md`, read the memory files, then read the current
implementation. Each requirement records DISCUSSION → DECISION → APPROVED
REQUIREMENT → IMPLEMENTATION → CURRENT STATE. Where history and code disagree,
both are recorded and the status reflects the code.

Status is judged against the approved *behaviour*, never against code
similarity — a refactor that still satisfies the requirement is PASS.

## Phase 2 (after you approve Phase 1) — CHECK SYSTEM

An admin-only screen at `/admin/integrity`:
- "CHECK SYSTEM" button, manual only, never scheduled.
- Runs the checklist one requirement at a time with live progress
  (`4 / 250 … PASS/FAIL`), grouped by domain, segment-by-segment results.
- Each requirement carries automatable checks where possible (route resolves,
  component/export exists, table/column/policy present, vitest suite passes,
  optional in-browser behaviour probe) and is marked
  `MANUAL — REQUIRES HUMAN CONFIRMATION` where it cannot be automated honestly.
- On FAIL: standard vs current vs difference, severity, affected dependencies,
  restoration source, and `CORRECT IT` / `SKIP`.
- Final report + persisted audit history (date, admin, counts, corrections,
  restoration versions, regression results).
- Per-requirement `APPROVE AS PERMANENT`, stored in the database so it never
  resets, plus explicit "change the permanent standard" and "retire".

## Phase 3 — controlled correction

`CORRECT IT` with no instructions uses the stored approved standard and
restoration source; optional free-text instruction is honoured when given.
Workflow: checkpoint → scope → load standard → apply → test → dependency
regression test → verify → report, with rollback on failure, and
`CORRECTION SOURCE UNAVAILABLE` when no verified source exists.

One honest constraint to agree up front: the running app cannot rewrite its own
source files. So `CORRECT IT` produces a locked, machine-readable **repair
order** (requirement ID, approved standard, restoration source, exact scope,
required tests) that is applied through this build channel and then re-checked
by the same button. Detection, approval, audit trail and re-verification are
fully in-app; the file edit itself is executed here.

## Sequencing

Phase 1 is large, so it is delivered in review-able passes and each pass appends
to the same documents:

1. Framework + ID scheme + `INVENTORY.md` skeleton + the 2D/Area regression
   report (your highest-priority example).
2. Geometry, Area, Diagrams, Smartboard, Floating Numbers, Tables, Math
   structures, Lesson Notes.
3. Accounts, roles, workspaces, Rotating Building + settings, Community, Live.
4. Adventure, Assignments, Assessment, Reports, Progress, Rewards.
5. Credits/plans/payments/gateways, Admin console, AI layers, stability.
6. Consolidation: dependency graph, restoration sources, validation-test matrix,
   Section J architecture.

No application behaviour changes in Phase 1.
