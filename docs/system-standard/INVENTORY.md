# MathGPL Permanent System Inventory & Integrity Checklist

Phase 1 delivery: audit, reconstruction, documentation and inventory. No
application behaviour was changed while producing it. Read `README.md` in this
folder first for the id scheme, status rules and evidence rules.

Machine-readable registry: `src/lib/integrity/standard/` (entry point
`src/lib/integrity/standard/index.ts`).

Totals at the time of writing: **185 requirements across 32 domains** —
169 `PASS`, 10 `PARTIAL`, 6 `UNKNOWN`, 0 `FAIL`, 0 `MISSING`.

---

## Section A — Complete system map

Every domain, its responsibility and its requirement count.

| Key | Domain | Reqs | Responsibility |
| --- | --- | --- | --- |
| PLAT | Platform Core & Navigation | 7 | Router, root layout, session provider, entry route, status/help/legal pages |
| AUTH | Authentication | 6 | Per-role auth pages, invitations, reset, provider configuration |
| ACCT | Accounts, Roles & Permissions | 7 | Five roles, capability engine, account ids, owner privileges, connections |
| WS | Workspaces & Tenancy | 5 | One identity/many workspaces, isolation, join codes, school view |
| RB | Rotating Building & Customisation | 6 | Landing surface, background vs building layers, 16 slots, ads |
| SITE | Public Marketing Site (CMS) | 3 | 13 editable sections, live stats, secret access entrance |
| LN | Lesson Notes (Notebook) | 12 | Section hierarchy, continuous document, modes, storage, archive |
| MATH | Mathematical Editing & Rendering | 7 | Structure model, shortcuts, matrices, asset registry, no raw syntax |
| TBL | Smart Tables | 6 | Table identity, Tk.n branches, per-step marking, calculator cells |
| CHT | Charts & Graphs | 7 | Bar/histogram geometry, pie validation, unbounded charts, report charts |
| GEO | 2D Geometry Editor | 11 | One engine, construction-based, lines/circles, selection properties, undo |
| AREA | Area Tool & Regions | 8 | Manual trace, line-picked regions, fill/density, rendering, deletion |
| GPROP | Geometry Properties & Relationships | 5 | Identity-bound properties, Geometry Map, relationship page, teacher test |
| G3D | 3D Geometry | 3 | 3D workspace, Wireframe/Solid + Teach controls, centre-based labels |
| DIAG | Diagram Lifecycle | 7 | Permanence, section ownership, zoom, Board A, floating exclusion, capture |
| SB | Smartboard (Two-Board) | 10 | Session recognition, Board A/B, writing/marking, tools, persistence |
| FLT | Floating Numbers Workflow | 7 | Selection Law, no reinterpretation, question scope, Evaluation, Check Line |
| SLD | Slides & Presentation | 3 | Note→Slide→Canvas→Preview→Exit, scrolling, capture/import |
| CLS | Teaching Hub, Classes & Membership | 5 | Workspace shell, class-owned copies, joining, layouts, teacher management |
| ASMT | Assignments, Assessment & Marking | 4 | Assignments, attempt lifecycle, derived marking, pre-generation validation |
| RPT | Reports & Progress | 2 | Student/class reports, read-only student aggregate |
| ADV | Adventure, Timers, Progress & Rewards | 9 | Separated timer/progress, timer settings/video, groups, rewards, blending |
| CRS | Courses | 3 | Builder, assignment/progress, video-link vs premium video |
| LIVE | MathGPL Live & Smart Cards | 4 | Sessions, join codes, broadcast links, public cards at /c/:slug |
| COMM | MathGPL Community | 2 | Read-only mirror, copy-to-workspace, discoverability and moderation |
| PAY | Credits, Plans & Payments | 6 | Credit metering, locked pricing, plans/entitlements, payments, free access |
| GW | Student Access Gateway | 2 | Three gateway slots over existing items, Stripe Connect payouts |
| ADM | Platform Admin Console | 5 | Owner-only console, analytics, impersonation logging, administered content |
| AST | GPL Assets & Media | 5 | Asset hierarchy, manager access, upload classification, picker, chroma cut |
| AI | AI Layers, Co-Pilot & Math Engine | 10 | Three layers, QUESTION_LOCK, pedagogy, verified maths, Co-Pilot procedure |
| STAB | Stability, Reliability & Access | 4 | Resource registry, never-freeze rule, local drafts, access runbook |
| DES | Design System & Editing Conventions | 4 | Legibility, right-panel editing rule, Edit affordance timing, themes |

Route surface discovered (grouped, not exhaustive per file): `/`, `/home`,
`/status`, `/help/connection`, legal pages, `/auth/*`, `/lesson-notes`,
`/mathboard`, `/smartboard`, `/teaching-hub/*`, `/live/*`, `/c/:slug`,
`/student/*`, `/school/*`, `/family/*`, `/community/*`, `/assets/*`,
`/adventure/games/$gameId`, `/courses`, `/plans`, `/g/:handle`, `/admin/*`, and
the standalone practice games (abacus, addition, bidmas, decimals, division,
factors, fractions, lcm, place value, primes, subtraction, multiplication,
tally).

---

## Section B — Historical summary

Reconstructed chronologically from project history, separating discussion,
decision, approved requirement, implementation and current state. Each phase
lists the requirement ids it produced.

1. **Charts and living diagrams.** Bar geometry rules, unbounded charts, direct
   bar editing, pie validation, histogram parity, and the Edit-affordance timing
   rule. → `CHT-001..007`, `DES-003`.
2. **Math editing rebuild.** Keyboard shortcuts, infinitely nesting editable
   cursor, asset favourites/recents, matrices, and the "no raw syntax" law.
   → `MATH-001..007`.
3. **Geometry tooling.** Selection-driven properties, Area trace modes,
   fill/opacity, delete, and the construction engine. → `GEO-*`, `AREA-*`.
4. **Workflow and AI structure.** Automatic Solution blocks, floating evaluation
   for marks, workspace isolation, layered reasoning, Check Line, attempt
   lifecycle. → `LN-006`, `FLT-005/006`, `ASMT-002`, `AI-008`, `WS-003`.
5. **Reporting, Live and Smart Cards.** Progress and trend charts, sessions with
   join codes, public card publishing, emoji library, role model.
   → `RPT-*`, `LIVE-*`, `MATH-007`, `ACCT-*`.
6. **Admin, homepage and workspace shell.** Owner console with gold accents,
   Enter Workspace impersonation, background/building layers, 16 slots,
   Teaching Hub + Live tabs, AI cover generator. → `ADM-*`, `RB-*`, `CLS-001`.
7. **Roles, community, courses, adventure 2.0.** Premium class layouts, read-only
   student hub, community mirror, course builder, video backgrounds with
   checkpoints, school console, parent hub. → `CLS-*`, `COMM-*`, `CRS-*`,
   `ADV-006`, `WS-005`, `ACCT-006`.
8. **Payments, pricing and credits.** Credit metering for every billable
   resource, FIFO ledger, subscription vs prepaid split, billboards, public CMS
   homepage, gateway. → `PAY-*`, `GW-*`, `SITE-*`, `RB-005`.
9. **Lesson-note hierarchy rebuild.** Seven section kinds, continuous document,
   Master Sensor, dustbin and archive, AI anchored under the session heading.
   → `LN-001..003`.
10. **Matrices, smartboard tools and slides.** SVG brackets, matrix functions,
    workbench vs committed diagram, board tool rails, slide canvas model.
    → `MATH-004`, `GEO-011`, `SB-008`, `SLD-*`.
11. **3D teaching controls and slide rebuild.** Wireframe/Solid, Teach mode with
    Open/Close Face and Reset, Note→Slide→Canvas→Preview→Exit. → `G3D-002`,
    `SLD-001`.
12. **Validation, asset redesign and one-engine rule.** Diagram undo in document
    history, pre-generation problem check, hierarchical GPL assets, label
    relevance. → `GEO-008`, `ASMT-004`, `AST-001`, `GEO-007`.
13. **Geometry properties and session-aware AI.** Relationship workspace
    entrance, everything-editable diagrams, session context for generation.
    → `GPROP-*`, `AI-009`.
14. **Co-Pilot.** The fixed ten-step procedure, persistence per lesson note,
    sequential build loop, Blueprint Review, cancellation lifecycle, training
    documentation. → `AI-006`, `AI-007`, `ASMT-004`.
15. **Independent mathematics engine.** Deterministic verification, construction
    geometry, dark ink, no reliance on general-model reasoning. → `AI-001`,
    `AI-005`, `GEO-002`, `DES-001`.
16. **Access and reliability.** `/status`, local drafts, RLS fixes, connection
    help, runbook, resource registry, watchdog. → `PLAT-005/006`, `STAB-*`.
17. **Session recognition and floating workflow.** Deterministic session
    boundaries, question-scoped floating board, Selection Law, Evaluation
    rename, durable session identity. → `SB-001`, `FLT-001/003`, `LN-008`.
18. **Diagram permanence and two boards.** Diagrams as permanent note objects,
    section ownership and ordering, one zoom control, Two-Board architecture,
    then the approved revert putting diagrams back on Board A and removing them
    from Floating. → `DIAG-001..005`, `SB-003/006`.
19. **Tables as first-class objects.** Table identity through the workflow,
    Tk.n branch numbering, per-step marking, calculator cells and sums,
    teacher-owned cell sensor. → `TBL-001..006`.
20. **Matrix correction.** Matrices reverted from table-like branches to atomic
    structures that expand on the board. → `MATH-004`, `FLT-004`.
21. **2D refresh.** Commit race fixed, continuous polylines, two-click circles.
    → `GEO-003/004/005`.
22. **Assets and media.** Background removal preserving quality, correct media
    classification, straight-alpha blending, one GPL media picker. → `AST-003/005`,
    `ADV-008`, `AST-004`.
23. **Timer work (most recent).** Delete control, free-entry duration, Nest
    preview, Video-mode field hiding, metadata-aware regions, no clock overlay,
    working preview. → `ADV-003`, `ADV-004`, `ADV-005`.
24. **This audit.** The permanent inventory, the standard's own integrity test,
    and the Area engine validation test. → this folder plus
    `src/lib/integrity/*`.

Revoked requirements deliberately recorded so they are not reintroduced:

- diagrams travelling into the Floating Numbers page (revoked 2026-08-24,
  `DIAG-005`);
- matrices as interactive table branches (revoked, `MATH-004`);
- Board B as a Calculator/Conversion companion (superseded by `SB-003`);
- an "Advanced" lesson-note section kind (removed, `LN-001`);
- the Specific/General geometry property layer (retired, `GPROP-003`).

---

## Section C — Permanent checklist

The checklist is the requirement registry itself. Each record carries: stable id,
name, category, source, requirement statement, approved behaviour (and where
relevant UI, data and permissions), implementation references, dependencies,
validation methods, restoration source, status, severity and permanent approval
state.

Files:

- `src/lib/integrity/standard/core.ts` — PLAT
- `src/lib/integrity/standard/identity.ts` — AUTH, ACCT, WS
- `src/lib/integrity/standard/building.ts` — RB, SITE
- `src/lib/integrity/standard/lessonNotes.ts` — LN, MATH, TBL, CHT
- `src/lib/integrity/standard/geometry.ts` — GEO, AREA, GPROP, G3D, DIAG
- `src/lib/integrity/standard/smartboard.ts` — SB, FLT, SLD
- `src/lib/integrity/standard/classroom.ts` — CLS, ASMT, RPT, ADV, CRS, LIVE, COMM
- `src/lib/integrity/standard/platformOps.ts` — PAY, GW, ADM, AST, AI, STAB, DES

Every record is written at segment level: for example Area is eight separate
requirements (two entrances, straight trace, curved trace, line-picked region,
colour/density on every close path, discard on tool change, rendering, deletion)
rather than one "Area works" entry.

---

## Section D — Implementation map

Held per requirement in the `implementation` field: files, symbols, routes,
tables, database functions, permissions and other resources. Cross-cutting
anchors:

| Concern | Anchor |
| --- | --- |
| Session/role resolution | `src/lib/accounts/useAccount.ts`, `ensure_account`, `has_role`, `has_capability` |
| Workspace scoping | `src/lib/accounts/useWorkspace.ts`, `workspaceScope.ts`, `current_org_id` |
| Lesson document | `src/components/lessonnotes/DocumentEditor.tsx`, `notebook_*` tables |
| Math structures | `src/components/structures/MathStructure.tsx`, `mathStructureLatex.ts`, `mathTreeLatex.ts` |
| Geometry engine | `src/lib/geometry/scene.ts`, `editor/sceneOps.ts`, `editor/regions.ts`, `editor/boundary.ts` |
| Board presentation | `src/lib/smartboard/presentation.ts`, `src/components/smartboard/PresentationView.tsx` |
| Floating workflow | `src/pages/FloatingNumbersPage.tsx`, `src/lib/floating/*` |
| Credits | `supabase/functions/_shared/creditGate.ts`, `usageMeter.ts`, `credit_*` tables |
| AI standards | `supabase/functions/notebook-ai/*Standard.ts`, `src/lib/mathengine/*` |
| Stability | `src/lib/stability/registry.ts`, `localDraft.ts`, `StabilityWatchdog.tsx` |

---

## Section E — Current status

169 `PASS`, 10 `PARTIAL`, 6 `UNKNOWN`, 0 `FAIL`, 0 `MISSING`.

`FAIL`/`MISSING` being zero is a statement about this pass, not a claim of
perfection: where behaviour could not be observed, the record says `UNKNOWN`
rather than guessing a failure or a pass.

Per-domain counts are produced from the registry by `summarise(ALL_DOMAINS)`.

---

## Section F — Known regressions and gaps

| Id | Status | Severity | Gap |
| --- | --- | --- | --- |
| `STAB-002` | PARTIAL | CRITICAL | Specific workspace freezes were fixed; no automated guard exists against the class of defect. |
| `WS-003` | PARTIAL | HIGH | Strict isolation is implemented; no automated cross-workspace isolation test pins it. |
| `AREA-005` | PARTIAL | MEDIUM | Double-click and Enter close paths drop the chosen fill/density and skip session finalisation. See `regressions/2d-area.md`. |
| `TBL-002` | PARTIAL | MEDIUM | Tk.n branch numbering works but is not pinned by a test. |
| `ADV-005` | PARTIAL | MEDIUM | Device + GPL asset choice confirmed for the timer video control only; other upload controls unaudited. |
| `ADV-008` | PARTIAL | MEDIUM | Assets processed before the straight-alpha change may still be premultiplied and need reprocessing. |
| `ADM-005` | PARTIAL | MEDIUM | The asset-manager capability exists; a console screen to whitelist a manager was not confirmed. |
| `CHT-001` | PARTIAL | LOW | Bar geometry rules implemented, no measurement test. |
| `FLT-005` | PARTIAL | LOW | Implementing file is still named `TeacherReasoningPanel.tsx`; visible labels unverified. |
| `DES-004` | PARTIAL | LOW | Token discipline not verified component-by-component. |
| `AUTH-002` | UNKNOWN | MEDIUM | Anonymous sign-in / auto-confirm settings are provider configuration, unverified. |
| `AUTH-006` | UNKNOWN | MEDIUM | Google provider configuration unverified. |
| `AREA-008` | UNKNOWN | LOW | Delete Diagram / region deletion not exercised. |
| `LN-011` | UNKNOWN | LOW | AI cover generation path not re-checked. |
| `PLAT-004` | UNKNOWN | LOW | Head metadata not audited route-by-route. |
| `ACCT-007` | UNKNOWN | LOW | Student-simplicity rule not exhaustively reviewed. |

One recorded tension needing human confirmation: `SB-002` (solution diagrams
withheld from the student board) versus `DIAG-004` (diagrams restored inline on
Board A). Both are approved; the note on `SB-002` asks for confirmation that the
current build honours both at once.

---

## Section G — Restoration sources

Each requirement names its own. The categories in use:

1. **Archived plans** under `.lovable/plan/` and `.lovable/drafts/**/plan-archive/`
   — e.g. the right-hand Add Area plan, the Board A revert, the one-zoom-control
   plan, the smartboard back-button plan, the workspace isolation plan.
2. **Project memory** (`mem://…`) — authoritative for rules such as credit
   economics, the universal editing rule, the Geometry Map, account roles.
3. **Immutable standards in the repository** —
   `supabase/functions/notebook-ai/integrityStandard.ts`,
   `pedagogyReference.ts`, `renderingStandard.ts`,
   `docs/pedagogical_reference_master_v9.docx`,
   `docs/MathGPL Knowledge Base/`.
4. **Tests that pin behaviour** — `src/lib/geometry/__tests__/area.test.ts`,
   the smartboard/lesson-note suites, `src/lib/integrity/__tests__/standard.test.ts`.
5. **Current implementation as reference** — used where the current code is the
   approved behaviour and no separate archive exists.
6. **`NONE`** — recorded where no safe source exists; CHECK SYSTEM must report
   `CORRECTION SOURCE UNAVAILABLE`.

---

## Section H — Dependencies

Dependencies are declared per requirement and traversable with
`dependentsOf(id)`. A test guarantees no dependency points at a non-existent id.
High-fan-out anchors, whose change forces the widest re-check:

- `WS-001` (workspace scoping) → rosters, community, classes, assets, isolation.
- `LN-008` (durable session identity) → floating scope, board recognition,
  diagram ordering.
- `MATH-001` / `MATH-006` (no raw syntax, lossless serialisation) → floating,
  board, AI editing.
- `AI-003` / `AI-005` (QUESTION_LOCK, verified maths) → every generated
  mathematics surface.
- `PAY-001` / `PAY-002` (credit metering and locked pricing) → plans, gateway,
  admin analytics, AI error handling.
- `STAB-002` (never freeze) → lesson notes, board, Co-Pilot.

---

## Section I — Validation tests

Existing automated coverage:

- `src/lib/geometry/__tests__/area.test.ts` — Area engine (6 tests, passing).
- `src/lib/integrity/__tests__/standard.test.ts` — standard integrity (8 tests,
  passing): unique ids, resolvable dependencies, mandatory source/restoration/
  checks, severity on every non-pass, no agent-granted permanent approval.
- Existing suites under `src/lib/smartboard/__tests__` and the lesson-note AI /
  matrix / symbol / token tests.

Gaps recorded as `TODO` inside requirement records, in priority order:

1. Workspace-freeze regression guard (`STAB-002`, CRITICAL).
2. Cross-workspace isolation suite (`WS-003`, HIGH).
3. Area close-path check covering click / double-click / Enter (`AREA-005`).
4. Tk.n branch numbering across multiple tables in one solution (`TBL-002`).
5. Chart bar geometry measurement (`CHT-001`).
6. Region deletion (`AREA-008`).

Validation methods available to CHECK SYSTEM: `route`, `module`, `database`,
`test`, `behaviour`, `manual` — declared per requirement so each check knows how
it can be proven and when a human must confirm.

---

## Section J — Future manual CHECK SYSTEM architecture

**Never automatic.** No scheduler, no post-deploy hook, no run on page load.

```text
Administrator opens /admin/integrity
        │
        ├─ loads the standard (ALL_DOMAINS) and stored approval/audit history
        ├─ walks requirements one by one, live progress "checking AREA-004 …"
        │      route     → resolve against the router
        │      module     → file exists and exports the named symbols
        │      database   → table/column/policy/function exists
        │      test       → run the named suite
        │      behaviour  → scripted interaction, or ask the Administrator
        │      manual     → ask the Administrator to confirm by eye
        │
        ├─ compares approved behaviour with current code / UI / data /
        │  permissions / tests wherever proof is possible
        ├─ reports the exact failure for each miss (what was expected, what was
        │  found, which file/table/route), then CONTINUES through the whole
        │  inventory — one failure never stops the run
        │
        └─ each failure offers:  CORRECT IT   |   SKIP
```

Correction path (Phase 3), only on explicit Administrator approval:

1. If the Administrator gives no instructions, use the approved standard and the
   requirement's `restorationSource`.
2. If `restorationSource` is `NONE`, show **CORRECTION SOURCE UNAVAILABLE** and
   stop — never invent a fix.
3. Create a backup/checkpoint before touching anything.
4. Scope edits to the failing requirement's implementation references only.
5. Apply the correction, then run the requirement's own checks plus the checks of
   every id returned by `dependentsOf(id)`.
6. Recheck the requirement. Roll back on failure. Report the outcome either way.

Persistence required for Phase 2/3 (tables to be added in that phase, not now):
permanent approvals per requirement id, audit history per run, corrections
applied, restoration versions, and regression results.

Constraint to respect in Phase 3: the running application cannot rewrite its own
source files. A correction therefore produces a scoped repair order applied
through the build channel. No silent rewriting, no broad redesign.
