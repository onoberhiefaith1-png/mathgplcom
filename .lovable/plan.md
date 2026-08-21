# Default Lesson Mode Rebuild — Manual First, AI Beside It

The lesson structure is unchanged: Introduction, Explanation, Example, Classwork, Exercise, Assignment/Homework, Conclusion, with the chosen quantities still deciding how many items appear. Only *how content gets created* changes.

## 1. Three modes, Manual as the default

The mode selector in the lesson-note top bar gains a third entry and Manual becomes the default for everyone:

```text
Lesson Mode ▾
   • Manual            (default — no AI generation)
   • AI Builder        (existing section AI tools, unchanged)
   • MathGPL Co-Pilot  (existing assistant, unchanged)
```

Neither AI system is removed. Every note opens in Manual mode from now on; teachers switch per note when they want AI, and the choice is remembered only for the current browser session's later notes.

A one-line notice under the bar states the active mode: "Manual — you build the lesson; AI only edits what you select."

## 2. What Manual mode shows and hides

Hidden in Manual mode (all *generation* affordances):
- the ✨ AI chip on every section heading (Regenerate / Paraphrase / Extend)
- the inline "generate with AI" affordance on empty blocks
- whole-lesson / whole-section generation entry points
- the Co-Pilot dock

Fully available in Manual mode:
- type, paste, upload images, upload/draw diagrams, equations, tables, Smart Table, graphs, matrices, emoji, slides
- Floating, Assign, Smart Card, drag-to-move, insertion menus
- **AI Edit** on a selection, and **AI Edit** on a diagram — the only AI paths, always teacher-initiated

Nothing decides where pasted content belongs: the teacher picks the section, then puts content there.

## 3. AI Edit is local and reversible

Selecting content and choosing AI Edit opens the right-hand AI Edit pane scoped to exactly that selection — cleaning formatting, rendering raw syntax such as `x^2 + 5x + 6 = 0` as proper mathematics, tidying wording, and preserving the mathematical meaning. Nothing outside the selection is touched, and nothing regenerates.

The pane's actions become: **Accept** · **Edit again** · **Cancel**. "Edit again" keeps the proposal in view and takes a further instruction; Cancel leaves the note exactly as it was.

## 4. Diagram AI Edit

The diagram's current **Edit** action is renamed **AI Edit** and opens the right-hand pane:

```text
Selected Diagram
[ diagram preview ]
What do you want to do with this diagram?
[ Make the lines thinner. Change label A to B. Add a right-angle marker. … ]
Apply   ·   Edit Again   ·   Cancel
```

Diagram work never requires AI: Upload → Draw → Manual edit stay first-class, with AI Edit as an extra. Manual geometry editing keeps its existing properties-panel path.

## 5. Diagram quality

AI-produced 2D mathematical diagrams stay textbook-grade: clean construction-engine geometry, one consistent thin stroke weight matched to the surrounding text, dark legible labels, correct geometry, and no 3D effects, shadows, decoration or blur.

## 6. Problems stay with their solutions

Every problem-bearing section pairs one problem with its own solution and numbers them automatically: Example 1 → Solution 1, Example 2 → Solution 2, Classwork 1 → Solution 1, and so on. A section never ends up with several problems and one detached general solution. Renumbering follows the note order when items are added, removed or reordered.

## 7. AI never freezes the workspace

While AI is analysing, generating or processing, the teacher can still scroll, type, edit, save, navigate sections, close the AI pane and cancel the request. AI work runs asynchronously with a real Cancel; failure, timeout, lost connection, quota or invalid output is reported *inside the AI pane only* and never alters existing content or leaves a blocking overlay.

## 8. Deferred

Separating a reusable LESSON from a TEACHING SESSION (reuse across classes, assignments, progress, subtopic re-use) is a data-model change and is planned as its own next step. Nothing in this build blocks it.

## Technical notes

- `src/lib/lessonnotes/aiMode.ts`: add `"manual"` to `LessonAiMode`, make it the default read/SSR value, bump the storage key so existing `mathengine`/`copilot` values do not carry over, and add `useSectionAiVisible()` (true only for `"mathengine"`); keep `useBuilderAiVisible` as an alias so existing call sites compile.
- `src/pages/NotebookEditorPage.tsx`: three-item mode dropdown labelled by active mode, notice line, `copilotOpen = mode === "copilot"`.
- `src/components/lessonnotes/extensions/SectionHeading.tsx` and `DocumentEditor.tsx` (inline empty-block affordance): gate generation UI on the section-AI selector, leaving Floating/Assign/Smart Card untouched.
- `src/components/lessonnotes/SelectionToolbar.tsx`: AI Edit is shown in all three modes (it is an editor, not a generator).
- `src/components/lessonnotes/AiEditPanel.tsx`: relabel to Accept / Edit again / Cancel, add the "edit again" re-prompt path, keep the target range scoped to the original selection, render errors in-panel, and add an abortable request with a Cancel that leaves the note untouched.
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` + `GeometryAiPanel.tsx`: rename the trigger to "AI Edit", show the selected-diagram preview and instruction prompt, and expose Apply / Edit Again / Cancel with the same abort/error handling.
- Numbering: a single pass in the document editor that walks section headings and assigns Example/Classwork/Exercise/Homework ordinals plus the matching Solution ordinal, run on structural change.
- No schema changes, no new generation path, no removal of the AI Builder or Co-Pilot code.

## Verification

In the preview on a real note: confirm a fresh note opens in Manual mode with no ✨ AI chips and no inline generate, while paste/draw/upload/table/equation all work; paste `x^2 + 5x + 6 = 0` into Example 2, run AI Edit, and confirm only Example 2 changes with Accept / Edit again / Cancel behaving as described; open a diagram's AI Edit, ask for thinner lines and a relabel, and confirm Apply / Edit Again / Cancel; during an AI request confirm scrolling, typing, saving and Cancel all still work and that a forced failure shows only inside the pane.
