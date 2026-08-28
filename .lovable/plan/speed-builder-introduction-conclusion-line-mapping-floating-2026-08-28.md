# Speed Builder — Introduction, Conclusion, Line Mapping & Floating-Number Display

## What is already correct (verified in code)

- Introduction and Conclusion are already optional events with their own keys (`intro`, `conclusion`), `lineId: null`, and `required: false`. They are never numbered lines and never enter the `Line 1 → Line N` sequence.
- Timeline ranges are keyed by durable identity (`line:<lineId>`), so a range can never drift to another line.
- Video mapping already uses the line ID (`sectionForLine`), never floating-number availability.
- If no Introduction exists, the video does not autoplay: playback only moves on a real line activation.
- Conclusion fires only when the final numbered line's mark is actually awarded, and it never becomes Line N+1.

## What is actually missing / wrong

1. The video editor row shows only `Line N` + start/end times. There is no floating-number column at all, so the teacher cannot see which mathematics a range belongs to, and there is no `NULL` state.
2. Because no floating-number content is shown, there is nothing bounding its width — as soon as it is shown, a long expression would stretch the row and push the timeline controls out of view.
3. Introduction and Conclusion currently sit in the same visual list as the numbered lines, which is what makes them look like `Line 0` / `Line N+1`.
4. Nothing in the test suite locks "a line with no floating numbers keeps its own number and its own video range".

## The change

### 1. Carry each line's own floating-number preview

`videoLinesFromQuestion` will attach a `preview` field per line, taken from that line's own compiled content in this order: its chips (floating numbers), else its equation text, else `null`. The `lineId` stays the source of truth; `preview` is display-only and never affects ordering, numbering or mapping. Note-only lines remain excluded — they are not mathematical lines.

### 2. Three-column line row

Each numbered row becomes: `Line N` | floating-number field | timeline (start / end).

- The floating-number field has a fixed maximum width and scrolls horizontally inside itself. The row never grows, and the start/end controls stay visible.
- When a line has no floating numbers, the field shows `NULL` in a muted style — explicitly "no floating-number content for this line", not "this line does not exist".

### 3. Introduction and Conclusion presented as optional events

They keep their existing behaviour and their own start/end fields, but are rendered as clearly labelled optional event rows, visually separated above `Line 1` and below `Line N`, with no line number and with the floating-number column replaced by a short "optional video event" caption. Their toggles stay where they are; when off, no row and no section exist at all.

### 4. Regression tests

New/extended tests asserting:
- a question whose Line 1 has no chips still yields `Line 1` first, with its own range, and `preview === null`;
- enabling/disabling Introduction and Conclusion never changes any line's number, key or range;
- Conclusion never appears as a numbered line and Introduction never appears as Line 0/1;
- no-Introduction means no autoplay; Introduction means autoplay at open;
- hashtag/line activation resolves strictly by line ID, including for a `NULL` line.

## Technical notes

- `src/lib/courses/questionVideo.ts` — add `preview?: string | null` to `VideoLine`, populate it in `videoLinesFromQuestion` from `chips` / `equationAscii`. `sectionsFor`, `writeBoundary`, `markersFor` and key derivation stay untouched.
- `src/lib/courses/exerciseBoard.ts`, `src/pages/class/TeacherExerciseQuestionsPage.tsx`, `src/pages/student/AssessmentBoardPage.tsx` — pass the raw line objects through so `preview` survives (no shape change at the call sites).
- `src/components/coursebuilder/QuestionVideoEditor.tsx` — row layout, bounded scroll container (`max-w`, `overflow-x-auto`, `whitespace-nowrap`), `NULL` state, optional-event rows.
- `src/components/smartboard/QuestionVideoPane.tsx` — no behavioural change expected; covered by tests only.
- Tests under `src/lib/courses/__tests__/`.

Nothing in the mathematics, marking, floating-number generation, preview approval or Smartboard pipelines changes.
