# Strict one-to-one line mapping for teaching videos

## What is wrong today

The Smartboard preview numbers **every** solution line, including a line that only
carries a note and no floating numbers (screenshot 1: `LINE 1` = the note "For",
`LINE 2` = `2x² + 5x − 3 = 0`).

The video editor builds its own list and **drops** any note-only line, then
renumbers what is left. So the editor's "Line 1" is actually solution Line 2 —
exactly the shift shown in screenshot 3, where Line 1 displays Line 2's floating
numbers (`+5x =0 2x² −3`). Confirmed in `src/lib/courses/questionVideo.ts`:
`videoLinesFromQuestion` skips `noteOnly` lines and labels each row
`Line ${out.length + 1}`.

The playback mapping itself is already identity-based (`line:<lineId>` keys), so
nothing about the timeline model needs redesigning — only the line list that
feeds it.

## The fix

1. **No line is ever removed.** Every solution line becomes a numbered video
   line, note-only lines included, so the numbers match the preview exactly:
   Line 1 → Line 1, Line 2 → Line 2, and so on.
2. **Numbering comes from the solution's own order**, not from the count of lines
   that happen to have floating numbers.
3. **NULL is a real state.** A line with no highlighted content shows `NULL` for
   its floating number and still keeps its own timeline row. Where the line has a
   note, the note is shown as quiet secondary text beside `NULL` so the teacher
   can recognise the line — it never becomes a floating number.
4. **Introduction and Conclusion stay optional events** with no line number and
   no floating number, exactly as they are now.
5. **Timelines keep their identity.** Ranges remain stored per `line:<lineId>`, so
   the ranges already saved for real lines stay attached to those same lines.
   Note-only lines simply appear as additional, currently unset rows.
6. **Bounded floating-number column** stays as-is (fixed width, horizontal scroll).

## Acceptance test to lock it in

The exact scenario from the request, as automated tests:

```text
Introduction  NULL         (optional event)
Line 1        NULL         00:19 → 01:14
Line 2        2x² + 5x − 3 = 0
Line 3        −5 ± √49
Line 4        ...
```

- Line 1 being NULL must never pull Line 2's floating numbers or timeline upward.
- A NULL line in the middle (Line 3) must not shift Line 4.
- Toggling Introduction/Conclusion must not renumber or re-key any line.
- Editor line numbers must equal the preview's line numbers for the same question.

## Technical details

- `src/lib/courses/questionVideo.ts`
  - `videoLinesFromQuestion`: stop skipping `noteOnly`; number rows by position in
    the full solution line list; set `preview` to the line's own chips, else its
    equation text, else `null`. Add an optional `note` field for display only.
  - `VideoLine` / `VideoSection`: carry `note?: string | null`; `sectionsFor`
    passes it through unchanged (keys, ordering and marker lookup untouched).
- `src/components/coursebuilder/QuestionVideoEditor.tsx`: render `NULL` plus the
  muted note text in the bounded floating-number cell for lines without chips.
- `src/components/smartboard/QuestionVideoPane.tsx`: verify the hashtag/line
  activation resolves the section via `lineId` (`sectionForLine`) and never by
  index, including for a NULL line — adjust only if it falls back to position.
- Tests: extend `src/lib/courses/__tests__/questionVideoStructure.test.ts` and add
  a no-shift acceptance case covering a leading note-only line and a mid-sequence
  NULL line.
- Untouched: the Highlighting page, floating-number generation, marking,
  evaluation, and the timeline/boundary logic (`writeBoundary`, gaps, overlaps).
