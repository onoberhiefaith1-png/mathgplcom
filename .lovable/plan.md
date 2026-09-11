# One Smartboard engine with multiple entry points

## Goal

Main Smartboard, Lesson Note testing, classroom teaching, and the student classroom view will open the same prepared lesson source in the same Smartboard engine. Classroom mode will add only class context, permissions, recovery, and live broadcasting.

Teacher test movements, reveals, answers, ink, and other sitting-specific changes will remain temporary. They will not overwrite the reusable lesson master.

## Confirmed architecture problem

- All current entry points ultimately render `PresentationView`, so the visual and interaction engine is already shared.
- The source entering that engine is not fully shared: normal and classroom launches use `buildBeats`/`buildReservoirs`, while the Lesson Note test compiles assessment-shaped data and then uses `buildAssessmentBoardSource`.
- The normal/class source builder still contains a fallback that derives Floating Number rows from written solution equations when prepared rows are absent.
- Classroom synchronization already carries notebook identity, a source fingerprint, stable line/chip IDs, and the publisher’s arrangement. It should remain a transport/recovery layer, not a lesson parser.

## Implementation

### 1. Define one canonical Smartboard lesson source

- Introduce one shared source contract for beats, questions, diagrams, and Floating Number reservoirs.
- Preserve every prepared Floating Number object exactly: stable object ID, line ID, chip ID/value, line order, chip order, grouping, mathematical structure, containers, arrangement, and authored note metadata.
- Produce a deterministic source fingerprint from that canonical structure.
- Treat the saved Lesson Note preparation data as the reusable master; runtime ink, movement, reveal, answer, score, and cursor state remain session state.

### 2. Route every gateway through the same source builder

- Make Main Smartboard, Lesson Note test, classroom teacher, and classroom student resolve the same canonical lesson source before rendering `PresentationView`.
- Remove gateway-specific source transformations from the Lesson Note test and classroom paths.
- Keep test-only evaluation controls outside the source builder.
- Keep classroom IDs, participants, permissions, and synchronization outside the source builder.

### 3. Eliminate text reconstruction of Floating Numbers

- Remove the solution-text fallback that invents Floating Number lines when prepared line data is missing.
- Never flatten a compiled bucket and guess new line boundaries.
- If a lesson has no prepared Floating Number structure, open the lesson without invented Floating Numbers and clearly preserve its ordinary note content.
- Add compatibility normalization for valid older saved structures only when their original line boundaries and ordering can be recovered deterministically; never guess from prose or equations.

### 4. Persist prepared content separately from session state

- Ensure the preparation flow saves the canonical line/chip structure used by all gateways.
- Keep temporary test changes isolated to the test sitting.
- Keep standalone presentation state isolated from classroom session state.
- Keep classroom recovery snapshots keyed by class, notebook, and canonical source fingerprint so stale or different lessons cannot be restored.

### 5. Keep classroom mode as an additive session layer

- Load the canonical lesson first, then attach the classroom session.
- Broadcast tiny operations against stable object, line, and chip IDs; do not broadcast re-parsed lesson content.
- Hydrate late/reconnected students from a matching classroom snapshot, then reconcile with live peers.
- Reject incompatible snapshots or deltas and fall back to the canonical saved lesson—not reconstructed text.
- Preserve teacher/student permissions and the existing active-student workflow.

### 6. Consolidate duplicated logic safely

- Replace duplicate lesson-to-board adapters with the canonical builder while retaining assessment grading adapters only for grading metadata.
- Keep one Floating Number renderer, one manipulation model, one serializer/deserializer, and one line-grouping implementation.
- Add development diagnostics that report gateway, notebook, source fingerprint, line IDs, chip IDs, and rejected recovery state without exposing them in normal use.

## Data compatibility

- Audit existing lesson records for prepared lines, highlights, and compiled buckets.
- Backfill only records whose prepared structure can be recovered losslessly from saved authored data.
- Do not convert solution prose into new Floating Number content.
- Flag unrecoverable lessons for teacher preparation rather than silently generating a different classroom version.

## Verification

- Add parity tests proving the same lesson produces byte-equivalent canonical beats, reservoirs, line IDs, chip IDs, mathematical structures, and fingerprints through every gateway.
- Cover multiple lines, repeated values, powers, subscripts, roots, fractions, empty script placeholders, tables, diagrams, notes, and deliberately arranged chips.
- Verify temporary test movement/reveal/answer state does not alter the reusable master.
- Verify the T1 Quadratic Equation lesson matches line-for-line between Lesson Note test, Main Smartboard, classroom teacher, and classroom student.
- Move one chip and reveal one line in class; confirm only that identified object/line changes for the student in real time.
- Verify notebook switching, deletion, reconnect, and late join never restore another lesson or merge lines.

## Acceptance result

The teacher can trust: “If the prepared lesson works on the Smartboard test, it opens identically in class.” The only classroom difference is the attached live session and its audience.