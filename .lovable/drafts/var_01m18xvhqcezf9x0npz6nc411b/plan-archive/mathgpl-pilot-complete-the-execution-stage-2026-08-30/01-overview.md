# MathGPL Pilot — complete the execution stage

The existing Pilot flow stays exactly as it is: opening line, the seven-row structure card with number selectors, optional additional information, Proceed, blueprint review, build, supervision. Nothing in that sequence, the editor, or the Smartboard is redesigned.

What is missing today, confirmed by reading the current code:

- The draft (blueprint) only produces a one-line description per item ("what will be built here"). It does not contain the actual questions.
- Items are keyed `example-1`, and that key is a build-queue position only — it is not carried into the note, so a later "change Classwork 2" has nothing durable to point at.
- At build time the approved plan line is passed as an *instruction* and the question is generated again from scratch, so the question the teacher approved is not necessarily the question that lands in the note.
- After the build, editing a question in the note leaves its old solution attached; nothing marks the solution stale.

This upgrade closes those four gaps and leaves everything else alone.

## 1. First Proceed produces the real questions

The draft stage keeps its current shape but each question-bearing item now also carries the actual question, generated through the same math engine the build uses. Explanation, introduction and summary items keep their planning line, since they have no question.

Every item gets a stable identity of the requested form — `example_001`, `classwork_001`, `homework_001`, `exercise_001` — assigned once at draft time and never renumbered when items are reordered, added or deleted.

## 2. The draft is editable per question

The blueprint card gains, per item, the approved question itself: edit it, replace it, delete the item, add another item of the same kind, or ask for a change in words ("make Classwork 3 harder"). Only the named item changes; the rest of the draft is untouched. The existing note editor and its math shortcuts are used for the editing surface.

## 3. Second Proceed writes the lesson, all the way to the end

The build commits the approved question verbatim (question lock), then generates its complete worked solution and keeps the pair linked by the item id. Introduction, explanation and summary are written in full. The run is sequential per item, so twenty classwork questions are twenty complete generations, never a truncated single response.

## 4. One engine for Example, Classwork, Exercise, Assignment

All four go through the same question → solution → verification → linked pair path. The only difference is presentation: for classwork, exercise and assignment the student sees the question while the teacher and the Smartboard keep the linked solution.

## 5. Question and solution stay synchronised

When a question changes — teacher edit in the note, or an AI revision — its stored solution is marked invalid, regenerated, verified, and saved back against the same item id. A stale solution can never remain attached to a changed question.
