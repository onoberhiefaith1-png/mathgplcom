# Context-aware AI generation (session-wide, not block-only)

The AI currently judges a request from the text of one block only. Verified in the code:

- `getSolutionSource` in `src/components/lessonnotes/DocumentEditor.tsx` serialises only the range
  between the closest prior heading and the Solution heading, then hands that single string to
  `analyzeProblem`.
- `analyzeProblem` in `src/lib/lessonnotes/problemDetect.ts` returns `empty` / `incomplete` from
  that string alone; `ProblemCheckDialog` then hides "Generate anyway" whenever `report.problem`
  is blank, which is the hard block seen when the section is empty.
- The blueprint stage (`src/lib/lessonnotes/ai/pipeline/blueprint.ts`) is sent only
  `material` + topic/subtopic. When the teacher typed nothing into the popover, the material
  bundle is empty, the backend cannot build a blueprint, and the stage fails as
  "Could not read the material".

Nothing in that chain can see a question, diagram or solution that lives in a neighbouring
section of the same session — which is exactly the case in the screenshots.

## What changes

### 1. One session context package

Add `src/lib/lessonnotes/ai/sessionContext.ts` that, for any insertion point, collects the whole
session (from the owning subtopic/session heading to its end, not just above the caret):

- every heading with its detected kind and level
- each block's mathematics via the existing math-aware serialiser
- diagrams, with the question id each one belongs to (reuse `diagramsOwnedByQuestion`
  and `questionContextForPos`)
- tables, graphs and solution blocks belonging to each question

It returns: the focused block, its owning question, that question's linked diagram and solution,
plus a compact digest of the rest of the session. `DocumentEditor` builds it once per AI action
and passes it to both the check and the pipeline.

### 2. The check reads the package, and never dead-ends

`analyzeProblem` gains an optional second source: related content from the same question
(diagram present anywhere in the question span, mathematics in the sibling Solution block, table
or graph data). Rules:

- mathematics found anywhere in the question → `valid`, and the report says where it was found
  ("Mathematics found in the Solution block of this question", "Diagram belonging to this
  question").
- an instruction plus a linked diagram → `valid` (the figure is the data).
- nothing anywhere in the session → still reported, but the dialog always offers a way forward:
  "Generate a new question" instead of a dead end. `ProblemCheckDialog` shows the sources
  inspected and drops the current hard block on the empty case.

### 3. The pipeline always has material

`runBlueprintStage` receives the session package. When the teacher typed nothing, the material is
assembled from the document: focused-block text, the owning question, its diagram description and
its solution, plus topic/subtopic/level. The intake describes the source honestly ("read from the
lesson note"). Only a genuinely empty session (no topic, no subtopic, no content) reports
"nothing to work from", and that message names what was searched.

### 4. Backend receives the context

`notebook-ai` `blueprint` mode accepts a `sessionContext` field (headings + question/diagram/
solution digest) and is instructed to treat it as the authoritative lesson state: reproduce the
teacher's existing question when one exists, and never invent a different one. The existing
QUESTION_LOCK and inheritance standards stay in force.

## Technical notes

- Extraction reuses the existing frame-aware walkers (`canvasFrame`, `solutionMath`,
  `solutionProse`, level-3 Solution headings) so free-positioned content is included.
- No change to the structural ownership model: question ids remain the binding key; the package
  is read-only derived state.
- Diagram content is passed as a text inventory (points, segments, labels) — no image round-trip.

## Out of scope

Smartboard, geometry map generation, slides, reports, dashboards.

## Verification

In the preview: click AI on an empty Example (expect a usable dialog, not a dead end); click
Generate Solution on an Exercise whose only data is a diagram (expect `valid`); on an Exercise
whose mathematics sits in the Solution block (expect `valid` naming that source); confirm a
question that already exists is reproduced rather than replaced.
