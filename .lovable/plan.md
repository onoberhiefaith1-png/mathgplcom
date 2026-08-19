# MathGPL Lesson Note Co-Pilot — close the remaining gaps

Most of what this brief describes is already in the project and confirmed by reading the code: the Co-Pilot button in the lesson note top bar, the one-third right-hand dock (slide-over on narrow screens), the chat with typing/paste/voice, the PLAN / CREATE switch, proposal-then-approval with Approve / Reject, the stepped run checklist, and the fixed procedure (greeting → structure counts → additional information → analysis → build → supervision). The backend `copilot` mode already carries the platform knowledge, the live note snapshot (per-section question, solution, diagram), the "never destroy work / prefer adding over replacing" rules, and only ever returns actions that map onto the note's own functions.

So this is not a rebuild. It is a targeted pass to make the parts of the brief that are still weak behave exactly as described.

## What changes

1. **Discussion-first is enforced, not encouraged.** In PLAN mode the Co-Pilot may never act — any action returned is dropped and shown as a proposal only. In CREATE mode only purely additive work runs immediately; anything that replaces, rewrites or deletes existing content always shows a one-line confirmation first. This becomes a hard client-side rule rather than a prompt instruction the model could ignore.

2. **Ambiguity ends in a question, never a guess.** When a reference ("Example 2", "it", "this question") matches more than one section in the live note, the Co-Pilot asks one short question instead of proposing. Actions whose target section cannot be resolved are refused with a plain explanation rather than falling back to the cursor.

3. **Geometry reuse is guaranteed.** "Use the diagram we already have", "reposition it", "map this solution" can only ever reach the existing linked diagram and the existing Geometry Map. A Geometry Map action on a question with no solution is refused with a reason; a map or diagram request on a question that already owns a diagram never creates a second one. This keeps the one-question-one-diagram-one-solution lock in force.

4. **Duplication guards on the note actions.** "Generate the solution" on a question that already has one says so and offers to replace instead of appending a second solution. The same check applies to inserting a section the structure already produced.

5. **Action feedback reads like the brief.** The run checklist shows the teacher-facing step names ("Reading Example 2", "Checking mathematical difficulty", "Generating worked solution", "Updating lesson note", "Completed"), a failure names the step that stopped and leaves earlier steps applied, and undo remains the note's own history.

6. **Naming.** The button and panel title read **MathGPL Co-Pilot** consistently (the brief writes "MyGPT" in one place; the product name is MathGPL).

Not in scope: any new generator, geometry engine or table engine; Smartboard, student-facing or dashboard changes; persisting the transcript.

## Technical notes

- `src/lib/lessonnotes/copilot/conversation.ts`: gate `execute` on mode and destructiveness before running (PLAN drops actions entirely); resolve every action target against the snapshot and refuse unresolved ones; add the duplicate-solution / existing-diagram / missing-solution pre-checks before the run starts.
- `src/lib/lessonnotes/copilot/actions.ts`: extend the action guards so `buildGeometryMap`, `openGeometry2D` and `generateSolution` validate the target entry's state (has solution, already has diagram) instead of only checking that a ref exists.
- `supabase/functions/notebook-ai/index.ts` (`mode: "copilot"`): tighten the PLAN-mode instruction to forbid actions outright, and add the ask-one-question-on-ambiguity and geometry-reuse rules to the `HOW YOU WORK` block. No new mode.
- `src/components/lessonnotes/copilot/CoPilotPanel.tsx` and `BuildProgress.tsx`: confirmation line for destructive proposals, step labels, failed-step message, title wording.
- No changes to `DocumentEditor.tsx` generation paths, the geometry engines, Smart Table, slides or the asset library — the bridge keeps calling the handlers that already exist.

## Verification

On a real note in the preview: ask a question in PLAN mode (analysis only, nothing changes); "make Example 2 harder" in CREATE mode (proposal naming the real Example 2, its question and its existing solution, then a stepped run touching only that block); "map this solution" (existing Geometry Map on the existing diagram, no second diagram); "generate the solution" where one exists (says so, offers replacement); an ambiguous "change example 2" with two matches (asks which one).
