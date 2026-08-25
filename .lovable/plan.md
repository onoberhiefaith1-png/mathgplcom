# Audit Dashboard — segment-by-segment integrity checking

Turn the Phase 1 inventory (185 requirements, 32 domains) into an admin Audit Dashboard.
The standard stays exactly as written: no ID is renamed, no requirement is deleted, and
no audit run may add, weaken or retire a requirement.

## Structure

```text
SYSTEM  →  SEGMENTS  →  REQUIREMENTS  →  EVIDENCE  →  STATUS  →  CORRECTION  →  RE-AUDIT
```

Segments are the 32 domains already declared in the standard registry (Rotating Building,
Lesson Notes, Smartboard, Diagrams, Tables, Charts, Matrix/Math structures, Adventure,
Assessment, Reports, Student/Teacher surfaces, etc.). Nothing is invented — the registry is
the source of truth, so if a page exists in the standard it appears as a segment.

## Screen 1 — Audit Dashboard (`/admin/integrity`)

- Top strip: live global totals (PASS / PARTIAL / UNKNOWN / FAIL / MISSING), always summed
  from individual requirement results, never stored as a number.
- Segment table with columns: Segment · Total · PASS · PARTIAL · UNKNOWN · FAIL · Status ·
  Last audited · Action. Worst status wins for the segment badge; segments with problems sort
  to the top so the broken area is visible instantly.
- Row actions: **Open** and **Audit this segment**.
- No global "audit everything" button on this screen; auditing is per segment by design.

## Screen 2 — Segment audit page (`/admin/integrity/$segment`)

Shows only that segment's requirements — never the full 185.

- Header: segment name, coverage note, counts (e.g. `15 requirements → 12 PASS → 2 PARTIAL →
  1 UNKNOWN → 0 FAIL`), buttons **Audit this segment** / **Audit again**.
- Requirement table: ID · Requirement · Status · Evidence / Problem · Action.
- Every PARTIAL / UNKNOWN / FAIL row states the reason in plain words and offers **Review / Fix**.
- Status meanings are enforced in the checker, not guessed: PASS = verified; PARTIAL = exists
  but incomplete/incorrect; UNKNOWN = insufficient evidence; FAIL/MISSING = demonstrably
  absent or broken. UNKNOWN is never upgraded to PASS just because no problem was found —
  it only becomes PASS when a check actually proves the behaviour.

## Screen 3 — Review / Fix drawer

For one requirement, in order:
1. Requirement (ID + name)
2. Expected behaviour from the standard
3. Current observed behaviour (what the checks found)
4. Why it is PARTIAL / UNKNOWN / FAIL
5. Recommended correction, derived from the standard and its restoration source; when no
   verified source exists it says **CORRECTION SOURCE UNAVAILABLE** instead of guessing
6. **Re-audit** — re-runs the checks for that requirement only and reports the new status

The running app cannot rewrite its own source, so "Fix" produces a locked, copyable repair
order (requirement ID, approved standard, restoration source, exact scope, required tests)
which is applied through the build channel and then verified with **Re-audit**.

## Audit history

Each segment keeps its own history, so improving one page never disturbs the rest:

```text
Smart Table
  Audit #1 — 12 PASS / 2 PARTIAL / 1 UNKNOWN
  Audit #2 — 14 PASS / 1 PARTIAL / 0 UNKNOWN
  Audit #3 — 15 PASS / 0 PARTIAL / 0 UNKNOWN
```

History rows record date, who ran it, counts, and per-requirement results.

## Running an audit (segment-scoped, manual only)

Auditing is always triggered by the administrator, never scheduled and never automatic.
Clicking **Audit this segment** runs only that segment's `validation` checks, one requirement
at a time with live progress (`4 / 15 … PASS`):

- `module` — file exists and exports the named symbols
- `route` — path resolves in the router
- `database` — table / column / policy / function exists
- `test` — the named vitest suite passes
- `behaviour` — scripted probe; reported UNKNOWN when it cannot run
- `manual` — reported `MANUAL — REQUIRES HUMAN CONFIRMATION`, never auto-PASS

A requirement's result is the worst outcome across its checks. Before any audit has run, a
segment shows the registry's recorded Phase 1 status so today's totals (169 / 10 / 6 / 0)
are the starting point.

## Technical details

- Route files: `src/routes/admin/integrity/index.tsx` and
  `src/routes/admin/integrity/$segment.tsx`, pages under `src/pages/admin/integrity/`,
  reusing `DashboardShell` / admin dash tokens like the other admin pages.
- New read-only helpers in `src/lib/integrity/` (registry untouched):
  - `segments.ts` — derives segment rows from `ALL_DOMAINS` + latest stored results.
  - `runner.ts` — `runSegmentAudit(key)`, requirement-at-a-time, progress callback.
- Checks that need the filesystem, router tree or database run in
  `src/lib/integrity/audit.functions.ts` server functions guarded by the existing admin
  capability check; the UI streams results via TanStack Query.
- Persistence (Lovable Cloud, admin-only RLS + explicit GRANTs):
  - `integrity_audit_runs` — id, segment_key, run_no, started_at, finished_at, actor,
    counts, notes.
  - `integrity_requirement_results` — run_id, requirement_id, status, evidence, reason,
    check_details.
  - `integrity_repair_orders` — requirement_id, segment_key, standard snapshot, restoration
    source, scope, status (OPEN / APPLIED / VERIFIED), created_at.
- Global totals are computed by folding the latest result per requirement over the registry,
  so re-auditing one segment updates the dashboard automatically with no hard-coded numbers.
- Vitest coverage: totals fold correctly, worst-status rollup, UNKNOWN never becomes PASS,
  segment run touches only its own requirement IDs.

## Out of scope

The standard files themselves are not edited. No automatic scheduling, no silent source
rewriting, no permanent-approval changes in this phase.
