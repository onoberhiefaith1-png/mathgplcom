## Smartboard Presentation Preview — Redesign

### Goal
Rebuild `/smartboard/:id/preview` as **PowerPoint Presenter View** for the Smartboard. The teacher sees exactly what students will see, plus three overlays: highlighted regions, floating-number groups, notebook notes. No JSON, no `[Object Object]`, no LaTeX source, no auto-generated captions like "Lesson title card shown first on board."

### Root cause of current bugs
`SmartboardPreviewPage.tsx` renders `beat.content` / `beat.caption` / `beat.reasoning` from `buildBeats()`. Some of those values are non-string (structured blocks) → React prints `[Object Object]`. It also injects our own prose ("Lesson title card shown first…", "Rehearsal mode…") and shows section-kind labels ("COVER", "INTRODUCTION"). That is debug UX, not teacher UX.

### New approach: read straight from the Lesson Note, render with Smartboard components

The preview will bypass the beat-string pipeline for display and instead pull the **same raw section/block rows** the Lesson Note uses, then paint them with the **same components the live board uses** (`SmartboardLessonText`, `FloatingNumberPanel`, `renderMathInline`). This guarantees visual parity and eliminates the object-stringification path.

### Layout (top → bottom, scrollable)

```text
┌─────────────────────────────────────────┐
│  Cover (title / subject / subtopic / date)  ← from notebook row, plain text
├─────────────────────────────────────────┤
│  Introduction   [👁 Present] [✏ AI]         ← raw lesson-note prose
├─────────────────────────────────────────┤
│  Explanation    [👁 Present] [✏ AI]         ← raw lesson-note prose
├─────────────────────────────────────────┤
│  Example 1                                  ← "Example 1" caption ONLY
│    Question:  x² + 5x + 6 = 0               ← raw problem block
│    Solution:                                ← Smartboard-style
│      🟧 x = (-b ± √(b²-4ac)) / 2a           ← highlighted region
│         🔵 -b   ±   √   b²   -4ac   2a      ← floating-number group
│      📘 The quadratic formula is used …     ← notebook note (if any)
│    [👁 Present] [✏ AI]
├─────────────────────────────────────────┤
│  Exercise 1 / Classwork / Homework …        ← same shape, question only
├─────────────────────────────────────────┤
│  Summary                                     ← raw prose
└─────────────────────────────────────────┘
[Approve & Go Live]  [Reset skips]
```

Rules the redesign enforces:

1. **Everything outside Solution is copied verbatim** from `notebook_sections` / `notebook_blocks`. No regeneration, no summary, no auto-description.
2. **Only the Solution section merges** with highlighted regions + floating numbers + notebook notes.
3. **No internal data ever leaks**: any value that is not a string gets rejected at the render boundary (guard helper `asDisplayString`) instead of being splatted into JSX.
4. **Captions** are minimal — `Example 1`, `Exercise 1`, etc. No section-kind pills, no "COVER" chrome, no "Lesson title card shown first…" copy, no rehearsal banner.
5. Each block gets **👁 Present / 🚫 Skip** (existing `presentationPlan` logic reused) and **✏ AI Edit** (opens a popover scoped to that line only).
6. Approve & Go Live keeps its current behavior (marks plan approved, launches `/smartboard/:id`).

### Files

**Rewrite (single file, no new backend):**
- `src/pages/SmartboardPreviewPage.tsx` — replace the current implementation. New page:
  - Reads `sections`, `notebook`, `blocks` via `useNotebook`.
  - For each section, renders the raw `content_ascii` (introduction, explanation, summary) using `SmartboardLessonText` (same renderer live board uses).
  - For each numbered subsection (example / exercise / classwork / homework):
    - Caption: `Example N` etc. (nothing else).
    - Problem: raw `content_ascii` via `SmartboardLessonText`.
    - Solution: iterates `buildReservoirs()` line-by-line and paints:
      - Highlighted equation via `renderMathInline` inside a subtle amber box (visual identical to Smartboard highlight).
      - Floating-number chips using the **same FloatingNumberPanel visual** (or a thin read-only wrapper matching it) so chip order/style match the live board 1:1.
      - Notebook note (if `line.notebook`) as a `📘 Note` prose block, unhighlighted.
  - Cover: reads `notebook.title`, `notebook.subject`, `notebook.subtopic`, and today's date — nothing else.
  - Adds `asDisplayString(x)` helper: returns `""` when `x` is not a primitive string/number, so a stray object can never render as `[Object Object]`.
- `src/components/smartboard/preview/PreviewAiEdit.tsx` *(new, small)* — line-scoped AI popover. Reuses the existing `floating-assistant` edge function with a payload containing only the clicked line's payload + role, then the caller mutates the corresponding `floating_highlights` row and lets the preview re-fetch.

**Unchanged:**
- `presentation.ts`, `presentationPlan.ts`, `PresentationView.tsx`, shelf, routing. The redesign is purely presentational.

### Guardrails / laws preserved
- **Note-Purity Law** and **Note-Attachment Law** are enforced by the existing `buildReservoirs`; the preview reads through it unchanged.
- **Zero re-interpretation**: preview reads the exact same data the live board reads.
- **Universal**: no line-count assumptions — works for 1 line or 10,000.

### Acceptance checks
- No occurrence of `[Object Object]`, `undefined`, JSON braces, or the strings "Lesson title card", "Rehearsal mode", or section-kind chrome anywhere on the page.
- Cover shows title / subject / subtopic / date only.
- Introduction / Explanation / Summary text matches the Lesson Note character-for-character.
- Example/Exercise captions read exactly `Example 1`, `Exercise 1`, etc.
- Highlighted equations render inside an amber highlight box; floating chips appear directly under them in the same order as the Floating Numbers page.
- Notebook notes only appear where `line.notebook` is non-empty (Note-Purity + Attachment already guarantee this).
- Present / Skip pills continue to work; Approve & Go Live still launches the live board.
