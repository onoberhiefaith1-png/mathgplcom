# AI Edit: Educational Upscaling

## Goal
Change what AI Edit is for. It stops acting as a rewriter or generator and becomes an **upscaler**: it keeps the teacher's lesson and its method, repairs what is damaged, fills in what is missing, and presents it to a professional standard.

Rule: **Add, don't subtract.** Remove something only when it is clearly wrong or a duplicate.

## What changes

### 1. New core standard: Educational Upscaling
A new standard sits above the existing reconstruction rules. Every AI Edit request receives it. It covers:
- Keep the teacher's questions, examples, solutions, methods, terms, order, difficulty and objective.
- Never swap in a "better" method. If the teacher uses the quadratic formula, the solution uses the quadratic formula.
- Never delete useful information because it is messy. Understand it, restructure it, render it properly.
- Never add unrelated examples just to fill space.

### 2. Read the whole lesson first
Before changing anything, AI Edit builds a lesson map:
Topic → Subtopic → Objective → Sections → Problems → Solutions → Methods → Visuals.
It gets this from the lesson title, the section headings and the text around the draft. For a highlighted selection, it also sees the note's topic, subtopic and nearby sections, so no sentence is judged on its own.

### 3. Problem + Solution as one connected unit
Every Example, Classwork, Exercise, Homework or Assessment item is paired with its solution:
- A solution exists: keep it and improve how it looks.
- A solution is incomplete: add the missing steps using the same method.
- A solution is missing: write one using the method taught in the lesson.
- The question is damaged (for example "0x² + 4x + 5", or spoken-style text): rebuild it from evidence (the topic, the solution, later references to it). If there is not enough evidence, flag it and do not invent it.

A problem is never left without a solution.

### 4. Visuals come from the content
The topic, the question and the relationships decide which object to draw, not keywords. For example, "centre O, angle AOB = 80°, find ACB" gives a circle with centre O, radii OA and OB, and the angle at C, not a plain triangle. The same approach applies to tables, graphs, matrices and Venn diagrams: if the content needs one, it is created even when the source had none.

### 5. Two-layer validation before Accept
- **Content check:** Did we keep what the teacher meant? This covers each original problem, its numbers, its method, its section order, and whether any content was dropped.
- **Maths check:** Does each solution answer its own question? Do the steps follow on? Do the labels and values in the diagram match the text? Are required solutions or visuals present? Is the notation correct?

If either check fails, AI Edit retries once with the specific problem named. Anything still wrong is shown in the preview as a review note. Nothing reaches the note until the teacher clicks Accept.

### 6. Preview shows what was upscaled
The existing preview gains a short summary, for example "Kept 3 examples, completed 2 solutions, rebuilt 1 question, added 1 diagram". It also lists any items that need review. The panel layout stays the same.

### 7. Unchanged
- Both entry paths: highlight → replace, and open directly → insert.
- QUESTION_LOCK. A rebuilt question is only allowed when the source is visibly damaged, and the original is shown alongside it.
- The one-micro-step-per-line solution standard.
- Smartboard, Floating Numbers, Game and saved notes.

## Technical details
- New `supabase/functions/notebook-ai/upscalingStandard.ts` (UPSCALING_STANDARD), injected into the edit prompt ahead of `EDUCATIONAL_RECONSTRUCTION_STANDARD`. The edit path always uses the solution-level knowledge bundle (`editKnowledgeBlocks` with forceAll for compose and lesson-sized edits).
- The client sends a compact `lessonMap` (topic, subtopic, section headings, neighbouring content) with AI Edit requests, built from the existing `collectLessonContext`.
- The model returns a small `upscaleReport` alongside the content: pairs, completions, reconstructions, visuals, and unclear items. The schema has no bounds. It is parsed tolerantly, with a fallback to no report.
- New server-side `upscaleVerifier.ts`:
  - Preservation: every problem detected in the source must still appear, with the same numbers unless it is flagged as reconstructed, and the method keywords must match.
  - Completeness: every problem block has a solution block.
  - Coherence: reuses `completenessVerifier` plus the geometry relationship checks.
  - Allows one targeted retry.
- A client test suite covers: a missing solution gets filled in; the teacher's method is kept (the formula is not replaced by factorising); a damaged question is rebuilt only with evidence; the circle-centre diagram is right; classwork items all get solutions; messy content is not deleted.
- Deploy `notebook-ai`, then run a real compose test with a pasted quadratic-formula lesson.

## Acceptance
1. A lesson with 2 examples (one without a solution) and 3 classwork questions: all 5 have solutions, and the teacher's wording and order are kept.
2. A teacher solves with the formula: the output still uses the formula.
3. "0x² + 4x + 5 = 0" in a lesson on the quadratic formula, whose solution uses a = 3: the question is restored to 3x² + 4x + 5 = 0 and flagged as reconstructed.
4. The circle-centre question produces a circle diagram with O, the radii and the correct angles.
5. Content that is messy but useful is restructured, not removed.
6. Highlight → AI Edit → Accept replacement still works.
