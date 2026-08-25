# Clearing the 10 PARTIAL and 6 UNKNOWN audit items

Goal: move all 16 non-PASS requirements to an honest PASS. Requirement IDs and
requirement text stay exactly as approved — only the implementation, the proofs
and the recorded status change.

Rule kept throughout: nothing becomes PASS because I "couldn't find a problem".
Each item ends with either a real code fix, an automated test that pins the
behaviour, or a verification I can actually run. Anything I cannot honestly
prove stays UNKNOWN and is handed back to you.

## Group 1 — Real defect to repair (1 item)

**AREA-005 — chosen colour/density on every close path.** Closing a trace on
the first point passes the teacher's fill and density and finalises the
session; closing by double-click or Enter calls the region builder with no
options, so the region falls back to engine defaults, the session is not
finalised and the new region is not selected. Fix: route all three close paths
through one shared "close the trace" function, then cover it with a test.

## Group 2 — Missing proofs to add (4 items)

These behaviours are implemented but nothing pins them, so a future change
could silently break them.

- **STAB-002 (CRITICAL) — workspace must never freeze.** Add a regression suite
  around the section-switch / overlay / layout path: repeated section switches,
  overlay open-close cycles, and a layout-loop guard, so a re-introduced freeze
  fails a test instead of reaching you.
- **WS-003 (HIGH) — workspace data isolation.** Add a suite that builds two
  workspaces and asserts every scoped list, shelf and picker returns only the
  active workspace's rows.
- **TBL-002 — table branch numbering.** Test that two tables in one solution
  produce T1.x then T2.x and never renumber the main L1..Ln sequence.
- **CHT-001 — bar geometry.** Test bar width = 2% of plot width, gap = bar
  width, first-bar offset = bar width, histogram gap = 0.

## Group 3 — Verify and record (5 items)

Each is inspected properly this time, and the audit records what I actually
observed.

- **AREA-008** — exercise region delete and diagram delete; confirm deleting a
  region leaves its boundary lines intact, and add a test for it.
- **LN-011** — the cover designer exists (`CoverDesignerDialog`); verify a
  generated cover persists on the notebook and pin the save path.
- **ADM-005** — the whitelist screen exists (`AssetManagersCard`); confirm it is
  reachable from the console and gated by `can_manage_gpl_assets`.
- **FLT-005** — the panel already reads "Evaluation" in the UI; the file is
  still named `TeacherReasoningPanel.tsx`. Rename the file and its imports so
  the naming matches the approved wording.
- **PLAT-004 / ACCT-007 / DES-004** — three sweep audits: unique `head()`
  metadata on every content route; student routes carry no authoring or admin
  controls; components use theme tokens rather than hard-coded colour classes.
  Where a sweep finds a real breach I fix it; the sweep itself becomes a test so
  it stays true.

## Group 4 — I need your instruction (3 items)

I will start on Groups 1–3 immediately and pause on these:

1. **ADV-005 — every upload offers "My device" and "My GPL assets".** There are
   about 28 upload controls across the platform (avatars, homepage building and
   background, adverts, website content, course backgrounds, game sounds and
   narration, slides, emoji, notebook scan, AI intake, admin asset dialogs).
   Which of these must offer the GPL library? My assumption unless you say
   otherwise: every *scene/media* upload does (building, background, adverts,
   website content, course background, slides, sounds, narration, timer video),
   while avatars, notebook scans and AI file intake stay device-only.
2. **ADV-008 — legacy transparent media.** Newly processed media is correct;
   assets processed before the fix may still carry a plate. Do you want a
   one-off reprocess of the existing library, an on-open reprocess as each old
   asset is used, or to leave old assets alone and only guarantee new ones?
3. **AUTH-002 / AUTH-006 — live auth settings.** These need the actual provider
   configuration confirmed, which I can only verify by changing/reading backend
   auth settings: anonymous sign-in disabled, email confirmation NOT
   auto-confirmed, and Google enabled so first use does not error. Confirm you
   want me to set Google up and keep confirmations on, and I will apply and
   verify it rather than leaving it UNKNOWN.

## How each item closes

For every item: fix or prove → run that item's test → re-audit only its segment
from the dashboard → the requirement's recorded status and evidence are updated
to what the run actually showed. Global totals recompute themselves from the
individual results, so the header moves as items clear.

## Technical notes

- `AREA-005`: single `closeTrace(kind, options)` helper in
  `GeometryCanvas.tsx`, called by the first-point, double-click and Enter
  handlers; unit test drives the shared helper.
- New suites live in `src/lib/**/__tests__/`, plus
  `src/lib/integrity/__tests__/sweeps.test.ts` for the route-metadata,
  student-surface and colour-token sweeps.
- Requirement records in `src/lib/integrity/standard/*` are edited only in
  `status`, `severity`, `notes` and `validation` (swapping each `TODO — no test`
  entry for the real test path). IDs, requirement text and `permanent` are
  untouched.
- No standard is retired or reworded, and no permanent approval is granted.
