# Teach Aura the whole of MathGPL

Aura already exists and already works: she listens, speaks, and really does things (creates classes, writes lesson notes, shares notes with a class, assigns games, teaches aloud, moves the screen). What she is missing is not power — it is understanding.

Three gaps confirmed by inspecting the app:

1. **She is blind to where you are.** Nothing tells her which page is open, which class, note, board or Adventure you are looking at. She only knows what she fetches herself at the start of a conversation.
2. **She knows features, not workflows.** Her instructions describe her tools and the mathematics rules, but never what a teacher actually does first, next and after saving in each part of MathGPL.
3. **She is only proactive once** — in her opening greeting. After that she waits.

This plan fixes all three, with deep fluency over the workflows she can already act on (your choice), full context awareness including live detail, and proactivity where she does the routine step herself and only asks on real decisions.

## What changes for you

- Aura always knows where you are: the page, the class, the lesson note, the section you are in, the board, the Adventure, the question line, the student you are looking at.
- When you say "let's add the first session" or "put some floating numbers here", she knows what those actually are in MathGPL and follows the real steps — not an invented workflow.
- She stays a step ahead: "We're in the Exercise section. Next is the solution steps — want me to write them?" and then does the obvious step without asking permission for it.
- She never claims she did something she cannot do. Where she has no action available, she walks you through it on screen while you work together.
- She answers "how do I..." questions with the real MathGPL path, using the names you see in the app.

## The knowledge she gets

A written operational map of the platform, feature by feature, each with: what it is, why it exists, who uses it, where it lives, the first step, what follows, required inputs, what saving creates, where the result appears, what to do next, and which features it connects to.

Covered: accounts and roles; the five workspaces; buildings, rooms and frames; classes, rosters, class codes and join codes; courses and Exercise Cards; lesson notes (notebook → sections → subsections → content) including how sessions really work; attaching notes to a class; Smartboard and the writing surface; Floating Numbers end to end; assignments; assessments; Adventures including scenes, checkpoints, video timing, rewards, groups and bar questions; MathGPL Live sessions; the 3D Slate Game; progress and reports; community; settings.

Three naming truths the map records so Aura stops guessing:

- **"Session"** means three different things in MathGPL. Inside a lesson note it is a section on the page (a section can literally be labelled "Session"). On a notebook it is also a plain text label. In MathGPL Live it is a scheduled teaching room with its own code. Aura must ask or infer which one you mean, never invent a fourth.
- **"Quiz"** does not exist. The real names are **Assessment** and, inside a course, **Exercise Card**.
- **Floating Numbers** are not separate objects you drop on a page. They are made by highlighting parts of a solution inside a lesson note's Example, Exercise or Classwork, which compiles them into chips that the Smartboard then uses live.

## Awareness while you work

A small piece of the app reports Aura's surroundings continuously: the current page, the named thing open on it, and the live detail that matters on that page (active question line, selected floating chips, which student's work is on screen). She receives that with every message, so you never explain your position again. When she has just done something, she checks it and reports what you can now see.

## Verification before it is called finished

She is asked the real questions and her answers are checked against the app: how to create a lesson; how sessions work; what happens after saving; what Floating Numbers are and how to use them; how to teach a lesson; how the Smartboard connects to the lesson; how to create an Adventure; what happens after uploading the video; what the student sees; what happens after a student submits. Anything she gets wrong is corrected in the map, not papered over in conversation.

## Technical notes

- New `src/lib/agent/knowledge/` holding the operational map as typed modules (`accounts.ts`, `buildings.ts`, `classes.ts`, `courses.ts`, `lessonNotes.ts`, `floatingNumbers.ts`, `smartboard.ts`, `assignments.ts`, `assessments.ts`, `adventures.ts`, `live.ts`, `slateGame.ts`, `reports.ts`, `settings.ts`), each entry: `id, title, purpose, whoUses, entryPath, firstStep, inputs, actions, onSave, whereItAppears, nextSteps, connectedTo, pitfalls`. Client-safe strings so tests can assert on them.
- `buildAgentSystemPrompt` in `src/lib/agent/systemPrompt.ts` gains a workflow-knowledge section. Because the full map is large, only the entries relevant to the current surface are injected per turn (route-keyed selection in `knowledge/select.ts`), plus a permanent compact index of every node so she never denies a feature exists. The mathematics, QUESTION_LOCK, safety and voice blocks stay byte-identical.
- New `src/lib/agent/context.ts` defines `AuraContext { path, routeId, role, workspaceId/Name, buildingId, classId/Name, notebookId/Title, sectionId/Kind, subsectionId, smartboardClassId, adventureId, sceneId, assessmentId, assignmentId, slateGameId, questionLine, selectedChips, studentId/Name }`. `AuraProvider.tsx` reads the router location plus a `useAuraContext(partial)` hook that any page calls to register its live detail; the merged snapshot is sent with every `agentChat` call and threaded into `runAgentTurn` as an extra system block. `AgentSnapshotHint` is populated at last (it is currently always empty on the chat path).
- Proactivity: a `NEXT STEP` rule block in the prompt plus a `workflow_next_step` read-only tool that returns the mapped next step for the current context, so her suggestion comes from the map rather than invention. Routine mapped steps execute without asking; destructive tools keep the existing `confirmed` gate untouched.
- Knowing vs acting: prompt rule plus a `capabilities` block listing which mapped actions have a tool behind them; for everything else she must say she will guide, and use `navigate`.
- Tests: `src/lib/agent/__tests__/knowledge.test.ts` (every entry has all fields; every `entryPath` resolves to a real route; no reference to non-existent concepts such as "quiz"), `context.test.ts` (route → context extraction), and prompt tests asserting the mathematics/safety blocks are unchanged and that route-keyed selection includes the expected entries.
- No database migration. No change to Smartboard, Floating Numbers, grading, the Slate Game or saved teacher designs.

## Out of scope

New abilities for Adventures, assignments and assessments (she will explain and guide those, not create them yet), voice/wake-word changes, and any rework of the features themselves.
