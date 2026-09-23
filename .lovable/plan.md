# Train Aura on lesson notes, Sessions, Floating Numbers and Smartboard testing

Aura already knows lesson notes exist. She does not yet know how a teacher actually
builds one: that every question lives in a **Session**, how Floating Numbers are
prepared and generated in two stages, what the arrangement controls really are, and
how a prepared question is tried out on the real student board before anyone sees it.

This plan writes that whole chain into her knowledge layer, in the teacher's own words,
step by step, and makes her follow it instead of inventing her own outline.

## What Aura will know afterwards

**1. Sessions are compulsory, not decoration**

Every question section — Example, Exercise, Classwork, Homework, Assessment — is a
Session: a heading plus its own Solution area, numbered and held together by a stable
id. The board reads the note Session by Session; that is how "Next" moves smoothly
from one question to the next, and how the teacher's board and the student's board stay
on exactly the same question. A question typed loosely into prose is invisible to the
board. So when Aura writes a lesson note she creates the Session first, then the
question inside it, then the solution under it — never an "Example:" line in ordinary text.
She will also know about "＋ Add Session" for a teacher's own titled session, and
"+ Add another" for a second Example, Exercise, Classwork or Homework.

**2. Floating Numbers, both stages, as they really are**

- Stage 1 — preparation: open the Solution's Floating chip, highlight the parts of the
  written solution that should become movable pieces. Each highlight becomes one line;
  the untouched prose in between becomes the notebook rows around it. Nothing is invented
  here — Floating Numbers only ever come out of a solution that is already written.
- Stage 2 — generation: on the Floating Numbers page, **Generate** turns each highlight
  into an equation line with its chips and its container shells (fraction, bracket,
  radical, power, log, integral, matrix, absolute value, vector). Lines the teacher has
  edited by hand are never overwritten. **Shuffle** re-orders the chips, chips can also
  be dragged by hand, **GAME** mode adds timers and Vault, **Save**, **Archive** keeps
  earlier generated configurations, **Reset** starts over.
- The honest correction: there is no "tight" or "scattered" spacing setting in MathGPL.
  What a teacher controls is how mixed-up the chips start — straight in solution order,
  or shuffled so students must rebuild the line — plus manual chip order and which
  container each chip sits inside. Aura will ask that question in those real words
  before she generates, rather than offering a setting that does not exist.

**3. Testing it on the Smartboard**

**Test on Smartboard** opens that one question on the real student board, scoped to
itself, with nothing saved and nothing recorded — the teacher's dry run. Aura will offer
this the moment a question's Floating Numbers are generated, take the teacher there, and
say what to look for: the question line, the chips present and movable, structures
stacked rather than flattened, the sensor entering fractions and exponents. Only after
that does she suggest **Assign**, which is the real thing: choose Classwork, Homework,
Assessment or Practice and tick the classes.

**4. The order she works in**

Note → Session → question → solution as micro-steps → highlight → Generate → ask about
chip arrangement → Test on Smartboard → Assign. She states which step she is on, does
the routine parts herself, and asks only where the teacher has a genuine choice.

## Technical notes

- `src/lib/agent/knowledge/lessonNotes.ts` — rewrite `lesson-sections`, `floating-numbers`
  and `smartboard` nodes with the real entry paths, button labels and step order; add two
  new nodes: `floating-preparation` (`/lesson-notes/$notebookId/floating-prep/$subsectionId`,
  highlight stage) and `floating-test` (`/lesson-notes/$notebookId/floating/$subsectionId/test`),
  and an `assign-question` note covering the Assign dialog's four kinds.
- `src/lib/agent/knowledge/index.ts` — register the new node ids; extend `NAMING_TRUTHS`
  with: every question lives in a Session; there is no tight/scattered spacing control,
  only chip arrangement via Shuffle and manual order; Test on Smartboard saves nothing,
  Assign does.
- `src/lib/agent/knowledge/select.ts` — route keys for `floating-prep`, `floating`, and the
  `/test` board so the right workflows load when the teacher is standing on those pages.
- `src/lib/agent/systemPrompt.ts` — add a short LESSON NOTE AUTHORING ORDER block: Session
  first, one micro-step per line, ask the chip-arrangement question before generating,
  offer the Smartboard test before assigning. Existing mathematics, safety and voice blocks
  stay byte-identical.
- `src/lib/agent/toolTypes.ts` / `tools.server.ts` — `create_lesson_note` and
  `append_lesson_lines` gain an explicit section kind / Session argument so she creates a
  real Session rather than a plain heading; `navigate` targets for the preparation, Floating
  Numbers and test-board routes. No new destructive tools.
- Tests: extend `src/lib/agent/__tests__/knowledge.test.ts` and `context.test.ts` — the new
  nodes resolve, the floating routes select the floating workflows, the naming truths are present.

Nothing changes in the Smartboard, Floating Numbers generation, grading, the Slate Game or
any saved teacher design; no database migration.
