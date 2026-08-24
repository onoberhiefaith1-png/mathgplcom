# Two-Board Smartboard Architecture

One Smartboard teaching environment, two synchronized boards — like a classroom with two physical boards used for the same lesson at the same time.

- **Board A** — the main teaching board: headings, text, questions, explanations, solutions, equations, emojis. Unchanged appearance.
- **Board B** — the interactive mathematics board: Diagram, Table, Graph, Calculator, Conversion for the **current section only**.

The existing top board-switch control stays exactly as it is. No desktop redesign, no new screens, no second copy of the lesson.

## Decisions confirmed

- Board B keeps the existing blank companion Lesson Note page as a secondary mode inside Board B; the section's interactive objects are its primary view.
- Board A no longer renders diagrams/tables/graphs — text, headings, equations and emojis only. The objects live on Board B.

## Single lesson position

The board already tracks one lesson position (`beatCursor` over the beats built from the lesson note). That stays the **only** position. Board B reads the same value, so:

```text
activeSection = example-1   ->  Board A: Example 1 text     Board B: Example 1 objects
Next -> example-2           ->  both boards move together
Back -> example-1           ->  both boards move back
```

Switching A <-> B never resets, never scrolls independently, never jumps to Introduction.

## Section-scoped Board B

Every beat already carries a stable section identity (section kind + ordinal, e.g. `example-1`) and its own object list with recorded placement. Board B renders only the objects whose section identity matches the active section, in their authored order.

- Section with no objects -> Board B is a clean empty workspace for that section (with the Calculator / Conversion / companion-page actions still available).
- Section with several objects -> all of them appear, in lesson order.
- Moving to another section clears the previous section's objects — no stale or duplicated content.

## Object state persistence

Board B object state (diagram edits, table values, graph settings, calculator/conversion state) is stored per section identity and per object id, so leaving a section and coming back — or switching boards — restores exactly what the teacher left. Diagram identity, teacher-authored Geometry Properties, segment/colour relationships, property selection and Smartboard testing all continue to work unchanged, because Board B renders the same diagram object, not a snapshot image.

## Responsive

- Desktop: current layout untouched.
- Tablet/mobile: Board B fits the viewport (objects scale to fit width, vertical scroll only) instead of exposing the middle of a desktop canvas. Both boards remain reachable through the existing switch and keep sharing one active section.

## Out of scope

Slide, Animate, Symbol, the lesson-note editor, navigation, colours, toolbars and every other working feature stay as they are.

## Technical notes

- `src/lib/smartboard/presentation.ts` — expose an explicit `sectionId` on each `Beat` (derived from the existing `sectionKind` + counter) and keep `objects` as the section's Board-B payload; classify object types into board A/B via a single `boardForObject()` helper so the rule is data-driven, not per-example.
- `src/components/smartboard/PresentationView.tsx` — Board A stops rendering Board-B object types (drop object rendering from the beat/notes path). `activeBoard` continues to drive the slide transition; Board B receives `sectionId` + the filtered object list.
- New `src/components/smartboard/InteractiveBoard.tsx` — Board B shell: section header, the section's objects rendered through the existing engines (`BoardToolLayer`, geometry/graph/table components), plus Calculator, Conversion, and a "Companion page" toggle that mounts the current `CompanionNoteBoard`.
- Board-B state: extend the existing board-scope persistence with a `sectionId` key so state is scoped per section; no schema change required (stored in the same board state JSON / notebook companion row).
- Live mirroring (`useSmartboardSync`) keeps publishing the single active section so student mirrors follow the same position.

## Acceptance test

Lesson "Geometry — Right-Angled Triangle" with Introduction (text + diagram), Example 1 (text + diagram), Solution 1 (text), Example 2 (text + graph), Exercise (text + table), Conclusion. Walk Introduction -> Example 1 -> Example 2 -> Exercise -> Example 1 and verify both boards follow the same sequence, Board B shows only that section's objects, and nothing resets when switching boards.
