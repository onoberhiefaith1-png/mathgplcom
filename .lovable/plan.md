## Smartboard Refactor — Presenter Preview as Single Source of Truth

### Goal
Make the Presenter Preview the ONLY validated lesson model. Floating Number Display and Present Mode become two fully independent rendering engines that both consume the Preview but share zero rendering code. A bug in one must never break the other.

---

### New Architecture

```text
Lesson Notes ─► Highlighting ─► Generation ─► PRESENTER PREVIEW (authoritative model)
                                                     │
                                    ┌────────────────┴────────────────┐
                                    ▼                                 ▼
                        Engine A: Floating Number          Engine B: Present Mode
                        Display (classroom mode)           (manual / student / fallback)
                        — existing behavior kept —         — new independent renderer —
```

Rule: neither engine imports from the other. Their only shared dependency is the Preview model + the low-level board primitive (ink placement on rows).

---

### Step 1 — Define the Authoritative Preview Model
Create `src/lib/smartboard/preview/model.ts` exporting a single frozen type built ONCE from lesson notes + highlighting + generation:

```ts
LessonModel = {
  beats: Beat[]                       // ordered cover/section/subsection/question/solution
}
Beat =
  | DisplayBeat { kind: "cover"|"intro"|"explanation"|"objectives"|"summary"|"example"|"exercise", blocks: Block[] }
  | SolutionBeat { kind: "solution", lines: SolutionLine[] }

SolutionLine = {
  id: string
  lineIdx: number
  note?: TeacherNote                  // strictly from precedingNotebook, via noteSource
  objects: PresentationObject[]       // ordered: chips, fractions, symbols, full-equation
  equationText: string                // canonical text for the whole line
}
TeacherNote = { paragraphs: string[] } // preserves paragraph breaks
PresentationObject =
  | { kind:"chip", text:string }
  | { kind:"fraction", sign,num,den }
  | { kind:"symbol", text:string }
  | { kind:"equation", text:string }
```

A single builder `buildLessonModel(notebook, highlights, generation)` produces this. It runs the existing validators (note purity, question lock, ordering) and freezes the result. This becomes the ONLY input to both engines.

---

### Step 2 — Delete the Tangled Paths
Remove the code paths where Present Mode or Floating Number reach past the Preview:

- Delete direct reads of `parsedSolution` / `precedingNotebook` from `PresentationView` and `FloatingNumberPanel`; both must go through `LessonModel`.
- Delete `buildReservoirs` positional/equation-match branches that don't come from the model.
- Retire whatever remains of the shared "one mode calls into the other" glue.
- `noteSource.ts` stays (its purity law is enforced inside the model builder now).

---

### Step 3 — Two Independent Rendering Pipelines

Both pipelines share ONLY the dumb primitive `planDirectWrite` + `ledger` (row bookkeeping). They do NOT share high-level rendering.

**Pipeline A — Floating Number Display** (`src/lib/smartboard/engines/floatingEngine/`)
- Keeps today's UX: sensor, chip taps, note button, auto-advance.
- Reads `LessonModel` for the active line's note + chips.
- No changes to teacher-facing behavior.

**Pipeline B — Present Mode** (`src/lib/smartboard/engines/presentEngine/`)
- New, independent renderer. Reads `LessonModel` only.
- Display beats: renders the beat's blocks as-is; no sensor, no cursor, no chips.
- Solution beats:
  - On entering a solution, places sensor one row below the "Solution" heading.
  - Each preview item click = copy that `PresentationObject` (or `TeacherNote`) verbatim onto the board via `planDirectWrite`, then auto-advance sensor.
  - Locks a line once the teacher advances to the next line (no back-edit).
  - Notes render with paragraph breaks preserved (multi-row write, one paragraph per row group).

Present Mode never calls floatingEngine functions and vice versa.

---

### Step 4 — Wiring
- `PresentationView.tsx`: builds `LessonModel` once per notebook load; passes it to whichever engine is active.
- Mode switch (Floating vs Present) picks the engine; both mount against the same board host (`BoardWriteHost`) but through their own controllers.
- `AiEditWorkspace` becomes the Present Mode click handler only (renamed to `PresentModeRunner`).

---

### Step 5 — Bug Guards Baked In
Enforced inside the model builder + Present engine:
1. Missing/incorrect/merged/split notes → builder rejects and logs; icon absent when note absent.
2. Paragraphs preserved: notes stored as `paragraphs[]`, written row-per-paragraph.
3. Highlighted math never leaks into notes (purity law already in `noteSource`).
4. Object ordering fixed at build time; engines cannot reorder.
5. Sensor: solution beat entry always seeds sensor = headingRow + 1; auto-advance after every insert.
6. Line lock: once `currentLineIdx` increments, prior rows are added to `lockedRows`.

---

### Step 6 — Verification
- Unit tests: `lessonModel.test.ts` (build correctness, note purity, ordering), `presentEngine.test.ts` (click → object copy, sensor advance, line lock), keep `floatingEngine` regression tests.
- Playwright on the quadratic lesson (`5e086fbb…`): 
  - Line 4 has no note icon in both engines.
  - Present Mode: click each object on lines 1–6, verify board matches Preview verbatim, sensor advances, previous line locks.
  - Kill-switch test: force floatingEngine to throw → Present Mode still completes the lesson.

---

### Files
**New**
- `src/lib/smartboard/preview/model.ts` (LessonModel + builder)
- `src/lib/smartboard/preview/buildFromNotebook.ts`
- `src/lib/smartboard/engines/floatingEngine/index.ts` (thin wrapper over today's floating channel)
- `src/lib/smartboard/engines/presentEngine/index.ts`
- `src/lib/smartboard/engines/presentEngine/renderDisplayBeat.ts`
- `src/lib/smartboard/engines/presentEngine/renderSolutionBeat.ts`
- `src/test/lessonModel.test.ts`, `src/test/presentEngine.test.ts`

**Edited**
- `src/components/smartboard/PresentationView.tsx` (build model, route to engine)
- `src/components/smartboard/PresenterPreviewPanel.tsx` (read from model)
- `src/components/smartboard/FloatingNumberPanel.tsx` (read from model)
- `src/components/smartboard/AiEditWorkspace.tsx` → renamed `PresentModeRunner.tsx`
- `src/lib/smartboard/presentation.ts` (delete positional guessing; export model-friendly shape)

**Kept as shared primitive only**
- `boardWriter/ledger.ts`, `boardWriter/directWrite.ts`, `boardWriter/host.ts`, `boardWriter/noteSource.ts`

**Deleted / retired**
- Old `previewChannel.ts` / `floatingChannel.ts` (folded into their engines with no cross-imports)
- Any lingering positional-fallback code in `buildReservoirs`

No database or backend changes.
