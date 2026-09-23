# AI Edit: Educational Drawing & Reconstruction Engine

## Goal
Upgrade AI Edit so it rebuilds copied or pasted lesson material into clean, native, editable Solmagine objects.

The key rule is: **the question and lesson content are the source of truth; the sketch is supporting evidence.** If a copied sketch is scattered, distorted, incomplete, or badly positioned, AI Edit should infer the intended educational object and redraw it cleanly instead of reproducing the mess.

## What will change

### 1. Content-first reconstruction
AI Edit will analyse the whole draft before deciding what to insert:

```text
Raw draft / screenshot / selected content
→ question and instructional meaning
→ mathematical relationships and labels
→ required educational objects
→ structured object descriptions
→ native Solmagine objects
→ editable lesson-note insertion
```

This means a draft that says “two parallel lines are crossed by a transversal” should produce two real parallel lines and a transversal, even if the copied sketch is poor or missing.

### 2. A dedicated reconstruction layer inside AI Edit
Add an internal “Drawing Plan” step that produces structured object instructions before anything is rendered. It will describe objects such as:

- geometry figures with points, lines, circles, angles, labels, measurements and relationships
- real tables with rows, columns, headers and cells
- matrices with editable cells
- graphs with axes, scale, points, curves, equations and labels
- set/Venn structures where supported by existing native tools
- native mathematical structures such as fractions, powers, roots, summations, integrals and simultaneous equations

AI Edit will then materialise those instructions through the existing Solmagine object system, not through screenshots or flat text.

### 3. Geometry becomes meaning-preserving, not pixel-copying
Geometry reconstruction will prioritise relationships over visual similarity:

- parallel lines must stay parallel
- perpendicular lines must stay perpendicular
- labelled points stay attached to their geometry
- angle labels stay attached to their angles
- measurements stay associated with the correct side or arc
- ambiguous geometry is flagged rather than silently invented

For the kind of issue shown in the uploaded screenshot, AI Edit should rebuild the circle/parallel-line examples as clean lesson diagrams instead of keeping scattered copied points, text and rough red sketching.

### 4. Tables, matrices, graphs and sets use native tools
AI Edit will treat educational structure as more important than copied formatting:

- scattered row/column data becomes a Smart Table or Maths Table
- bracketed arrays become native matrices
- graph questions become editable graph objects
- set notation and Venn-style content become native diagram/math structures where the platform supports them
- unsupported details are preserved as editable text with a review note rather than flattened into an image

### 5. Complete pasted lessons are reconstructed section-by-section
When a full lesson is pasted into AI Edit, it will identify each part of the lesson and produce a professional structured note:

- headings remain headings
- worked questions are separated from solutions
- each solution has one micro-step per line
- diagrams, tables, graphs and matrices become native objects
- no repeated “Problem:” or “Solution:” text is embedded as content
- unclear pieces are marked for teacher review before acceptance

### 6. Confidence and review handling
Each reconstructed object will carry an internal confidence level:

- **High:** insert normally
- **Medium:** insert, but show what should be checked
- **Low:** ask the teacher to confirm the missing or ambiguous information before creating a potentially wrong object

The preview must show when AI Edit is uncertain. The note should not be changed until the teacher clicks Accept.

### 7. Preserve the existing AI Edit interface
Do not redesign the panel.

Keep both existing entry paths:

- highlight content → AI Edit → Accept replaces the highlighted content
- open AI Edit directly → paste/type/attach → Accept inserts into the note

The upgrade is in the intelligence and native-object generation pipeline, not a new interface.

## Technical detail

- Extend the AI Edit prompt so it explicitly treats the draft as raw source material, not final layout.
- Add a structured “drawing plan” contract for object reconstruction before rendering.
- Expand the current directive materialiser so it can safely create/preview richer native objects from the drawing plan.
- Improve geometry generation so it can create common teaching layouts from question text alone, not only from coordinates in a sketch.
- Add validation for relationship preservation: parallel, perpendicular, labels, angle values, side lengths and ambiguity flags.
- Add preview diagnostics that explain what was reconstructed and what needs teacher review.
- Preserve the existing native duplication path so copied native objects remain independent when duplicated.

## Acceptance tests

1. Paste a messy copied geometry lesson like the uploaded example. AI Edit reconstructs clean editable diagrams, not scattered copied visuals.
2. Paste: “Two parallel lines are crossed by a transversal. One angle is 110°. Find the alternate angle.” AI Edit creates a clean native parallel-line diagram with the 110° angle and unknown angle placed correctly.
3. Paste a table written as scattered text. AI Edit creates an editable table with correct rows, columns and cells.
4. Paste a 3×3 matrix. AI Edit creates a native matrix with independently editable cells.
5. Paste `y = 2x + 3`. AI Edit creates an editable graph object where supported.
6. Paste a complete lesson with examples, solutions, a table and a matrix. AI Edit reconstructs the lesson into clean sections with native objects and one solution micro-step per line.
7. Try an ambiguous diagram. AI Edit flags the missing information instead of inventing it.
8. Existing highlight → AI Edit → Accept replacement still works exactly as before.

## Out of scope

This does not change Smartboard navigation, Floating Numbers generation, saved lesson notes, Game behaviour, or the existing lesson-note page layout.
