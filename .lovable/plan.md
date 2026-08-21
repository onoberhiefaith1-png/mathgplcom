# Session Segment Recognition & Smartboard Presentation

Manual lesson building stays exactly as it is. What changes is that MathsGPL keeps a deterministic, always-current map of where every session starts and ends, and the Smartboard presents from that map.

## 1. One deterministic lesson outline

A new module reads the editor document and returns an ordered list of segments:

```text
Session: Introduction   START -> content -> END (line before next marker)
Session: Example 1      START -> content -> END
Session: Solution 1     START -> content -> END
Session: Classwork      START -> content -> END
```

Each segment records its session kind, its display label (Example 1, Solution 2), its start/end positions, and its content items in document order: text, equation, table, smart table, 2D diagram, 3D geometry, image, chart.

Boundaries are computed from the document itself, never stored as line numbers. Add ten paragraphs, delete five, insert a diagram or a whole new session between two others, and the segments recompute on the next document change. No AI call is involved anywhere in this — it is pure editor state.

## 2. Structural headings vs ordinary text

Today a heading is classified by loose word matching, so a heading like "Introduction to cyclic quadrilaterals" can be mistaken for a new Introduction session.

New rule, in priority order:

1. A heading inserted from the Section menu is stamped as structural and carries its own kind. That stamp is authoritative.
2. For older notes with no stamp, a heading counts as structural only when the heading text *is* the session name (optionally with a number or trailing punctuation): "Introduction", "Example 2", "Solution 1", "Assignment". Anything longer, and any body paragraph, is ordinary content.

Body paragraphs are never treated as markers, regardless of the words in them. Question/Solution pairing follows the same segment order, so Solution 1 always belongs to Example 1 and Solution 2 to Example 2, even after sessions are inserted between them.

## 3. Presentation rules per content type

| Content | Normal session | Solution session |
| --- | --- | --- |
| Text / equation | Present | Present |
| Image | Present | Present (existing rules) |
| Table, Smart Table, LCM/stats table | Present | Present, unchanged behaviour |
| 2D diagram | Present | Kept in the note, excluded from the Smartboard guide |
| 3D geometry | Present | Kept in the note, excluded from the Smartboard guide |

Two gaps this closes:

- Diagrams placed in Introduction, Explanation, Classwork, Exercise, Assignment or Conclusion are currently dropped on the way to the Smartboard; they will now be carried through and presented with their session.
- 2D/3D visuals inside a Solution are carried through to the note as they are today but flagged as solution visuals so the guide skips them. The teacher shows them separately when they choose.

Smart Tables keep their existing component, interaction and floating behaviour exactly. The only change is that the system now knows which session a Smart Table belongs to. The existing floating-solution system is untouched.

## 4. Selecting a session presents that session

Choosing Introduction, Example 1 or Solution 1 presents that whole segment — from its start marker to the line before the next marker — with the presentation rules above applied.

## 5. Verification

Build a test note containing: Introduction (text + 2D diagram), Example 1 (question + 2D diagram), Solution 1 (text + 2D diagram + table), Example 2 (question + 3D object), Solution 2 (text + Smart Table), Classwork (question + diagram), Conclusion (text). Then confirm each segment's boundaries, that the Solution 1 diagram is absent from the guide while its table shows, that the Example 2 3D object shows, that the Solution 2 Smart Table still works, and that inserting a new session between two others re-splits the boundaries with no teacher action.

## Technical notes

- New `src/lib/lessonnotes/lessonOutline.ts`: `buildLessonOutline(doc)` returning `LessonSegment[]` (`kind`, `label`, `ordinal`, `from`, `to`, `items[]`). Reuses `containerRange.ts` helpers so canvas frames and solution cells are flattened the same way `syncDocumentToNotebook` already flattens them.
- `sectionKinds.ts`: add `structuralHeadingKind(text, level, attrs)` implementing the stamp-first, strict-text-fallback rule. `detectSectionKind` stays for loose uses (nav labels, AI context) but segmentation switches to the strict function.
- Heading extension: add `sessionKind` and `sessionOrdinal` attributes stamped by `insertSection` / `insertSubtopic` in `DocumentEditor.tsx`; parse/render them as `data-session-kind` so saved notes keep the stamp.
- `syncDocumentToNotebook.ts`: `parseDocumentToSections` delegates to the outline instead of its own heading walk; non-question sections use `renderBodyRich` so their objects survive; each object gains `inSolution: boolean` and `presentOnBoard: boolean` (false only for `geometryDiagram` / `scene3DDiagram` inside a Solution).
- `src/lib/floating/solutionItems.ts`: `SolutionObject` gains those two flags; `readSolutionObjects` defaults them for existing rows (legacy rows treat diagrams in solutions as excluded).
- `presentation.ts` / `PresentationView.tsx` / `SmartboardPreviewPage.tsx`: filter board objects on `presentOnBoard`; table families are never filtered.
- `SectionNav.tsx` labels come from the outline so Example 1 / Solution 1 numbering matches the segments.
- No schema change, no edge-function change, no AI call added.
