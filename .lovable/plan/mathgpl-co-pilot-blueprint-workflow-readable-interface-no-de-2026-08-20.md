# MathGPL Co-Pilot — blueprint workflow, readable interface, no dead ends

Confirmed from the code before planning:

- The Co-Pilot procedure today is greeting → structure → **additional information → analyse → build the whole lesson**. There is no blueprint step: `confirmStructure` moves to the material stage and `analyseThenBuild` runs the full build immediately after the analysis call (`src/lib/lessonnotes/copilot/conversation.ts`).
- "Analysing the topic…" is a genuine dead end: the analyse call is bounded only by a 120-second timeout, and while it runs the panel shows nothing but that one line with no sub-steps, no retry and no way to proceed.
- The white-on-white problem is real and comes from three cards that still use the old dark-theme tokens (`text-foreground/40`, `text-foreground/60`, `text-amber-200/70`, `bg-background/40`) while the panel itself is now white: `StructureCard.tsx`, `MaterialIntake.tsx`, `BuildProgress.tsx`.
- The PLAN / CREATE selector is already gone from the panel; only a leftover `copilotMode` field remains in the backend request type.
- Solutions are already generated for Example, Classwork, Exercise and Assignment/Homework during the build.

## What changes

**1. "Proceed" always means proceed.** Additional information becomes explicitly optional. The material step keeps its text / voice / photo / file intake but leads with a clear **Proceed without additional information** action, and typing "proceed", "go ahead", "build it", "carry on" at any waiting point is treated as that same instruction. Nothing waits for context that was never required.

**2. A blueprint step between structure and the lesson.** Confirming the structure no longer writes the lesson. The Co-Pilot first plans it and shows a blueprint: one line per planned item — Introduction, Explanation, each Example, each Classwork, Exercise, Assignment, Conclusion — describing what that item will teach or ask, with a note where a 2D diagram is needed and where an existing 3D asset should be placed instead. Only when the teacher approves ("Build it") is anything written into the lesson note.

**3. The blueprint is editable item by item.** Each row has an Edit control for direct rewording, and instructions like "change Example 2", "make Example 3 harder", "replace Classwork 1", "use a diagram here" revise only that row — the rest of the blueprint stays exactly as it is. The revised wording is what the build then uses.

**4. Meaningful, moving progress — never a silent wait.** Planning narrates real steps (analysing the topic → checking the mathematical structure → planning examples → checking progression → preparing the blueprint), and every call ends in one of three visible outcomes: the blueprint, a plain failure message with a **Try again** control, or a timeout message with the same control. The panel can never sit on one spinner line with no way forward.

**5. Full contrast audit of the Co-Pilot.** Every heading, label, structure row, number input, description, button, placeholder, status line, progress row and error message in the panel and its three cards moves to dark ink on white. No element keeps a light-on-light token.

**6. Professional, varied voice; no unnecessary questions.** The Co-Pilot decides difficulty, progression and whether a diagram is required from the topic instead of asking, states its decisions in the blueprint, and asks only when a genuine mathematical ambiguity blocks it. Greeting and stage wording vary with topic, subtopic and stage instead of repeating fixed phrases.

**7. Mathematics stays where it already is.** Every generated question and its solution continue to come from the existing MathGPL Math Engine and the note's own generators, with existing validation, the question-lock rule and the one-question-one-diagram-one-solution lock untouched. Geometry items that need a 2D diagram get one through the existing deterministic construction engine; 3D items are named as existing 3D assets to place, never drawn as fake diagrams.

Not in scope: any new generator or diagram engine, the lesson-note structure itself, the Math Engine mode, Smartboard, or student-facing screens.

## Technical notes

- `src/lib/lessonnotes/copilot/procedure.ts`: add a `blueprint` stage and a `BlueprintItem` type (`key`, `kind`, `label`, `plan` text, `needsDiagram`, `asset3d`, `edited` flag) derived from the confirmed counts; `itemInstruction` takes the approved `plan` text as the leading instruction for that item.
- `src/lib/lessonnotes/copilot/conversation.ts`: split `analyseThenBuild` into `planLesson` (analysis + blueprint, ends on the blueprint stage) and `runBuild` (only on approval); add `proceed()`, `editBlueprintItem(key, text)`, `reviseBlueprintItem(key, instruction)` and `retryLastStep()`; recognise proceed/build intents in `send` before calling the backend; drive a rotating progress label list while a call is in flight; on error or `RequestTimeoutError` set a retry-able state instead of leaving `busy` true.
- Backend `mode: "copilot"` in `supabase/functions/notebook-ai/index.ts`: add `stage: "blueprint"` returning `{ reply, blueprint: [{ key, plan, needsDiagram, asset3d }] }` and `stage: "reviseItem"` returning a single revised item; instruct it that missing material is normal, that it must not ask for it, and that it must decide diagram necessity itself. Drop the unused `copilotMode` field.
- New `src/components/lessonnotes/copilot/BlueprintCard.tsx`: the editable blueprint list with per-row Edit and a single **Build the lesson** action; rendered from `CoPilotPanel.tsx` at the blueprint stage.
- `StructureCard.tsx`, `MaterialIntake.tsx`, `BuildProgress.tsx`, `CoPilotPanel.tsx`: replace dark-theme tokens with the panel's slate-on-white scale; add the Proceed-without-information button and the retry line.

## Verification

In the preview, on a Geometry / Angles at the Centre of a Circle note: set Example 3, Classwork 3, Exercise 1, Assignment 1, click **Use this structure**, then type **Proceed** with nothing attached. The blueprint must appear within seconds with every row readable in dark text; "make Example 2 more difficult" must change only that row; "Build it" must write the full lesson with a complete solution under every question and a proper 2D diagram where the geometry needs one.
