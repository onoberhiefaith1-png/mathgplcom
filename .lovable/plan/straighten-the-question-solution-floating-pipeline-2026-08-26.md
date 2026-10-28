# Straighten the Question → Solution → Floating pipeline

## What is actually wrong (confirmed in your note)

Your note `Set` has two solutions that were **dragged out of the flow** into floating frames. They sit at the *end* of the document, and both are labelled "Solution 5", but their stored owners are:

- frame at end #1 → owner `q_v9hwnkur` = **Example 4**
- frame at end #2 → owner `q_ok6hjxab` = **Example 2** (the matrix one)

The segmentation layer (`buildLessonOutline`) reads the document as a flat list, so both detached solutions look like they come *after Example 5* and are folded into the last question above them. The database rows confirm the damage:

```text
Example 2  → problem EMPTY, solution EMPTY
Example 4  → solution EMPTY
Example 5  → solution = the frequency-table + SOHCAHTOA working (other questions' solutions)
```

So clicking **Floating** on Example 5 opens Example 5's row, which genuinely contains someone else's solution. The link is not random — the boundary rule is wrong: it uses *linear position* instead of the solution's recorded owner.

## The rule the pipeline will follow

1. A solution **starts** at its `Solution` heading and **ends** at the next structural heading inside the same container (unchanged).
2. A solution **belongs to** the question named by its `ownerQuestionId` — never to "the question above it in the flow" — whenever that id exists. Only a solution with no owner id falls back to the question above it (and gets stamped with an owner id at that moment, so it never drifts again).
3. A solution's number is derived from its owner: the solution of Example 2 is "Solution 2", wherever it physically sits on the page.
4. The Floating page always opens the row that carries the owner question's durable key, and shows which question it is working on.

## Work to do

**Segmentation (`src/lib/lessonnotes/lessonOutline.ts`)**
- Record on every segment: `sectionId` for question headings, `ownerQuestionId` for solution headings (taken from the heading attrs, or from the enclosing `canvasFrame` when the heading has none).
- Keep frames flattened for content collection, but no longer let their linear position decide ownership.
- Derive a solution segment's ordinal/label from its owner question segment instead of a running counter.

**Sync (`src/lib/lessonnotes/syncDocumentToNotebook.ts`)**
- `parseDocumentToSections`: a solution segment is folded into the question segment whose `sectionId` matches its `ownerQuestionId`; the "previous question" path stays only for owner-less legacy solutions. Solutions may therefore be processed out of linear order, so questions are all collected first, then solutions merged into their owners.
- Result: Example 2 gets the matrix solution, Example 4 gets the table solution, Example 5 keeps only its own SOHCAHTOA working.

**Resolution (`src/components/lessonnotes/extensions/SectionHeading.tsx`)**
- `docKeyForHeading` resolves the owner question through `ownerQuestionId` (assigning one when missing) and asks the outline for that segment's key; structural counting becomes the last-resort fallback only.
- Floating / Assign / Smart Card all reuse that single resolution path.

**Repair of existing notes (no data loss)**
- On open and on save, stamp `ownerQuestionId` on any in-flow solution heading that lacks one (safe: in-flow position is meaningful).
- Because sync updates rows in place by `doc_key`, one save of the note re-writes the three affected solution blocks correctly. No rows are deleted; floating highlights stay attached to their rows.
- Solution headings whose displayed number is wrong ("Solution 5" on Example 2's solution) will render their owner-derived label.

**Verification the teacher can see**
- The Floating prep page header shows the owning question label (e.g. `Example 2 — Solution`), so a wrong pairing is visible immediately instead of silently.

**Tests**
- Outline: a solution detached into a frame at the end of the document is still segmented under its owner question; ordinal/label follow the owner.
- Sync: reproduce your exact structure (5 examples, 2 detached solutions) and assert each subsection gets its own solution text and none get another's.
- Resolution: Floating from each Solution heading returns the subsection whose problem is that question.

## Out of scope

No change to how solutions are written, generated, highlighted or presented; no change to floating highlight data; no automatic renumbering of question headings.
