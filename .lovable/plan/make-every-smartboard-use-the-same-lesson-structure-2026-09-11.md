# Make every Smartboard use the same lesson structure

## Goal

A lesson tested from Lesson Notes must open with the same questions, Floating Number lines, chip order, powers, placeholders, and writing behaviour on the main Smartboard and the live class Smartboard. The test-only evaluation panel and class-only live sharing remain optional additions around that same board.

## Confirmed current difference

- All three surfaces render the same `PresentationView` board.
- The Lesson Note test supplies a prepared question source through `buildAssessmentBoardSource`.
- The main and class launches rebuild the lesson source through `buildReservoirs`.
- Opening from a class additionally enables `useSmartboardSync`. Its saved recovery snapshot contains board ink and Floating Number state, but no notebook/source identity. `openClassSmartBoard` changes the active notebook without clearing or validating the older saved snapshot. Therefore a class session can restore stale or incompatible line state that the main/test board never receives.

## Implementation

### 1. Introduce one canonical board-source contract
- Add a shared normalizer for questions and Floating Number lines.
- Preserve every line as an ordered object with its stable line ID, equation, exact chip list, container structure, notes, tables, marks, and fragment range.
- Make both lesson-note conversion and test-board conversion pass through this normalizer instead of maintaining separate assumptions.
- Keep evaluation/scoring metadata optional so removing the side panel does not change the mathematical board source.

### 2. Use the canonical source on every surface
- Lesson Note test, standalone Smartboard, class teacher Smartboard, and class student Smartboard will all receive the same normalized `beats` and `reservoirs` shape.
- Keep class-only realtime transport and test-only evaluation UI outside source construction.
- Preserve the existing route, controls, visual design, and student permissions.

### 3. Make class recovery source-safe
- Add a source identity to class snapshots: class ID, notebook ID, and a deterministic fingerprint of question IDs, line IDs, chip order, and structure.
- Apply a recovered or incoming snapshot only when that identity matches the board currently open.
- When a class changes to another notebook, start from that notebook’s canonical source instead of applying the previous notebook’s saved board state.
- Allow valid recovery for the same unchanged notebook, including reconnect and late student join.

### 4. Preserve exact lines through live sharing
- Publish each Floating Number line and chip by stable ID, in source order.
- On receipt, reconstruct one reservoir line per published line; never collapse a flat chip list into one row.
- Reject incomplete/incompatible Floating Number payloads and recover from the canonical lesson source rather than guessing or merging.
- Keep local teacher actions immediate; realtime remains responsible only for synchronizing the same board to students.

### 5. Add parity and regression tests
- Assert identical canonical source output for Lesson Note test, main, and class launch paths.
- Cover the reported multi-line lesson, including powers such as `2s²`, empty power placeholders, fractions, roots, notes, and tables.
- Verify notebook switching cannot restore the previous class snapshot.
- Verify reconnecting to the same notebook restores its valid state and preserves line/chip IDs and order.
- Verify teacher and student render the same line count and sequence without requiring refresh.

## Acceptance check

Open one prepared lesson in the Lesson Note test, standalone Smartboard, and live class Smartboard. In all three, compare every line from first to last: the line count, order, chip arrangement, powers/placeholders, and resulting board rows must match. The test page may additionally show evaluation and scores; the class page may additionally broadcast live state, but the mathematical board behaviour must be identical.
