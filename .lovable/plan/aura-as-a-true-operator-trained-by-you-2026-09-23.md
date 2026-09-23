# Aura as a true operator, trained by you

## First: was the earlier claim true?

Partly. Aura is right and the earlier summary was overstated.

What she really has today (17 abilities): look at your workspace, list and create
classes, list class students, remove a student (with your yes), list, create and
read lesson notes, add lines to a note, create a session inside a note, link a note
to a class, list games, link a game to a class, archive a note (with your yes),
teach out loud, look up a workflow, and move you to a page.

What she does **not** have today, despite the summary: she cannot highlight a
solution, cannot press Generate for Floating Numbers, cannot run Test on
Smartboard, and cannot assign a question. She also has no memory that survives
a refresh, so nothing you teach her is kept.

So the honest position is: she knows the correct order, and can do the first half
of it. This plan closes the rest.

## What this plan builds

### 1. The missing hands (so she stops handing work back)

New abilities, each reusing the code the app already runs — no second engine:

- **Highlight a solution** — mark the written solution lines of a question as the
  ones Floating Numbers will come from.
- **Generate Floating Numbers** — run the app's existing generator and save the
  chips exactly where the Smartboard reads them. She still asks the one real
  choice first: solution order or shuffled.
- **Test on Smartboard** — set up the dry run of that one question and open the
  board on it. Saves nothing, marks nobody.
- **Assign** — put the question in front of a class through the existing
  assignment pipeline, with the permanent-tick rules untouched.
- **Read back what happened** — after each of the above she reads the saved
  result and reports what she actually saw, not what she hoped.

### 2. Two modes of working with her

- **Training mode** — for you as administrator. She explores, describes only what
  she actually observed, states her reading of it, asks where she is unsure, tries
  safe low-risk actions, compares result with expectation, and writes down what
  you confirm or correct.
- **Task mode** — for ordinary teachers. They state an outcome; she does the
  routine steps without asking, asks only where a choice changes the result.

A teacher can never rewrite the rules you approved. Your corrections can never
loosen safety: anything that deletes, removes or archives still needs a clear yes.

### 3. Memory that lasts

A stored body of approved knowledge, one entry per workflow: the feature, who may
do it, the steps, what to expect, how it was verified, known failures, the date,
and a status — proposed, observed, approved by you, or retired. She proposes;
only you approve. Observed behaviour is kept apart from intended behaviour, so a
bug never becomes a rule. Retired entries keep their history rather than vanishing.

An admin page lists what she has proposed, with Approve, Correct and Retire.

### 4. Honesty, enforced

Her opening line and her reports are checked against what actually ran: she may
only claim something happened when a real action returned a real result. If she
lacks the button, she says exactly what is missing and gives you the smallest
possible handoff.

## Technical notes

- New table `aura_knowledge` (workspace-scoped, RLS + grants): feature, scope,
  roles, preconditions, steps, expected result, verification, failures, evidence,
  status, version, approved_by/at. Admin-only write on status; agent writes
  `proposed` rows only via a server function.
- New tools in `AGENT_TOOL_MANIFEST` + `tools.server.ts`, all executed with the
  teacher's own authenticated client so RLS applies unchanged:
  `highlight_solution`, `generate_floating_numbers` (wraps the existing
  `notebook-ai` floating mode + `persistGenerated` storage shape),
  `smartboard_test`, `assign_question` (via `src/lib/assignments/pipeline.ts`),
  `read_floating_numbers`, plus `propose_knowledge` / `recall_knowledge`.
  `assign_question` and anything destructive keep the `confirmed:true` gate.
- `systemPrompt.ts` gains the two-mode master prompt, the credentials rule
  (never request, store or repeat login secrets), the testing-and-repair
  discipline, and the persistence honesty rule. Existing mathematics, QUESTION_LOCK,
  safety and voice blocks stay byte-identical.
- Approved knowledge entries are injected next to the existing workflow map, marked
  as administrator-approved so they outrank Aura's own inference.
- Unchanged: Smartboard behaviour, Floating Numbers generation itself, grading,
  the Slate Game, saved teacher designs, voice and wake word.

## Out of scope

New abilities for Adventures, assessments and courses — she keeps guiding those
step by step until you ask for them next.
