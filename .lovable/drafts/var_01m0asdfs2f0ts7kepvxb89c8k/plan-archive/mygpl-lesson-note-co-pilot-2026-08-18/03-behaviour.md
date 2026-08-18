## What the Co-Pilot knows before it answers

On every turn it is given a read-only snapshot of the live note, not a guess:

- Subject, topic and the **active subtopic** (the existing lesson AI context store).
- The session it is looking at: each Example / Exercise / Classwork / Homework heading in order, with its question text, its Solution text, whether it owns a diagram, and a text inventory of that diagram (the existing session context package already builds this).
- Which block the cursor sits in, so "Example 2", "this question", "it" resolve to the real heading.
- The running conversation, so follow-ups like "make it harder" refer to the thing just discussed.

If a reference is ambiguous ("which Example 2?"), it asks instead of choosing.

## What it may do (the action set)

Each action maps to a function the note already has — nothing is reimplemented:

| Teacher intent | Action taken |
| --- | --- |
| Add / replace an example, exercise, classwork, homework | existing section insert + question generation pipeline, into the same session, keeping the label the app owns |
| "Generate the solution" | existing solution generation, anchored under the owning question, never duplicated |
| "Put this into a diagram" | existing Geometry 2D insert on that question |
| "Use the diagram we already have" | reuse the linked diagram; never creates a replacement |
| "Map this solution" | existing Geometry Map — derived from the actual solution, linked to the real diagram |
| "Calculate this table" | existing Smart Table |
| "Create a slide" | existing slide / canvas system |
| "Add an asset" | existing asset library insert |
| Rewrite / tidy a specific block | existing AI edit path, scoped to that block only |

Guarantees carried through every action: one question owns one diagram and one solution; question / solution / diagram links are preserved; the question text is never silently swapped (the existing question-lock and inheritance rules stay in force); unrelated sections are untouched; a replacement keeps the original recoverable through the note's own undo history.

## Mathematics discipline

The Co-Pilot answers as a mathematics teacher first: correctness, sound reasoning, difficulty matched to the note's level, O-level / year-appropriate wording, correct notation, correct note structure. It states uncertainty rather than inventing a relationship, and refuses to assert a geometric fact the diagram does not support.

## Out of scope for this build

Smartboard-side changes, student-facing features, dashboards, and any new geometry or table engine.
