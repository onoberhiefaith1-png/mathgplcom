# MathGPL Permanent System Standard — framework

This folder is the permanent, human-readable record of what MathGPL was approved
to do. It is paired with a machine-readable registry at
`src/lib/integrity/standard/` which the future Administrator-triggered CHECK
SYSTEM screen reads directly.

Phase 1 (this delivery) is **audit, reconstruction, documentation and inventory
only**. No application behaviour was changed while building it.

## Files

| File | Purpose |
| --- | --- |
| `README.md` | This framework: id scheme, status rules, evidence rules, phase boundaries. |
| `INVENTORY.md` | Sections A–J: system map, history, checklist, implementation map, status, regressions, restoration sources, dependencies, tests, CHECK SYSTEM architecture. |
| `regressions/2d-area.md` | The 2D/Area regression report in full detail. |
| `src/lib/integrity/types.ts` | Record types for the standard. |
| `src/lib/integrity/standard/*.ts` | The requirement records, one file per domain group. |
| `src/lib/integrity/__tests__/standard.test.ts` | Guards the standard's own integrity (unique ids, resolvable dependencies). |

## Id scheme

`DOMAIN-NNN`, e.g. `AREA-004`, `LN-008`, `STAB-002`.

- Ids are **stable**. They are never renumbered, never reused, never reordered.
- A retired requirement keeps its id and is marked `permanent: "RETIRED"`.
- Permanent approvals, correction history and regression results are keyed by id,
  so an id collision would corrupt the record. A test enforces uniqueness.

## Status rules

| Status | Meaning |
| --- | --- |
| `PASS` | The approved behaviour is present and evidenced. |
| `PARTIAL` | Part of the approved behaviour holds; a specific named gap remains. |
| `FAIL` | The approved behaviour is present in intent but broken. |
| `MISSING` | The approved behaviour is absent altogether. |
| `UNKNOWN` | Evidence was insufficient in this pass — **REQUIRES HUMAN CONFIRMATION**. |

Two rules govern how status is assigned:

1. **Status describes behaviour, not code shape.** A refactor that still
   satisfies the requirement is `PASS`. A rename, a moved file or a rewritten
   implementation is not a failure.
2. **Nothing is assumed.** If this pass did not read the code, run the test, or
   observe the behaviour, the status is `UNKNOWN` and says so. Broken or unclear
   functionality is recorded, never silently repaired.

`severity` (`CRITICAL` / `HIGH` / `MEDIUM` / `LOW`) is set on every requirement
that is not `PASS`.

## Evidence rules

Every requirement records a `source` — the discussion, decision, plan file or
memory entry that approved it. Sources fall into these kinds:

- **Approved requirement** — quoted or paraphrased from an explicit instruction.
- **Archived plan** — a file under `.lovable/plan/` or `.lovable/drafts/`.
- **Project memory** — a `mem://` entry, which is authoritative for rules.
- **code-evidenced** — read off an existing, clearly intentional implementation
  where no separate approval record survives.

Discussion is not decision, and decision is not implementation. Where the
history contains a requirement that was later revoked, the record keeps a
`notes` line naming the revocation so the old behaviour is not reintroduced by
accident (see `MATH-004`, `DIAG-005`).

`restorationSource` names a **verified** source usable for restoration: an
archived plan, a test that pins the behaviour, an authoritative memory rule, or
the current implementation when it is the reference. When no safe source exists
it reads `NONE` — CHECK SYSTEM must then report
`CORRECTION SOURCE UNAVAILABLE` instead of guessing.

## Phase boundaries

- **Phase 1 — inventory (this delivery).** Reconstruct, document, classify.
  No behaviour changes. No repairs. No redesign.
- **Phase 2 — CHECK SYSTEM.** An Administrator-only screen that runs the
  checklist on demand, requirement by requirement, with live progress and exact
  failure reporting. It never runs automatically.
- **Phase 3 — controlled correction.** A failure offers **CORRECT IT** or
  **SKIP**. Correction requires explicit Administrator approval, uses the
  approved standard/restoration source when no instructions are given, takes a
  checkpoint, scopes the edit, runs relevant and dependency regression tests,
  rechecks, and rolls back on failure. The running application cannot rewrite
  its own source, so a correction produces a scoped repair order applied through
  the build channel — never a silent rewrite and never a broad redesign.

## Permanent approval

`permanent` starts at `PENDING` for every requirement and only becomes
`APPROVED_PERMANENT` through an explicit Administrator action recorded in the
database. An agent must never mark a requirement permanently approved by editing
these files. A test enforces that the checked-in standard contains no
agent-granted approvals.
