# MathGPL — AI Mode Separation in the Lesson Workspace

One switch decides which AI owns the lesson note. The note itself — sections, editor, diagrams, tables, graphs, equations, geometry, floating numbers, slides, progress list — is untouched.

## 1. The mode selector

The current "MathGPL Co-Pilot" button in the lesson-note top bar becomes a small dropdown:

```text
MathGPL Co-Pilot ▾
   • MathGPL Co-Pilot     (one mathematical AI owns the lesson)
   • MathGPL Builder      (existing per-section AI tools)
```

- The active mode is visually obvious: Co-Pilot shows the amber active pill, Builder shows a neutral pill.
- Selecting a mode shows a one-line notice under the bar: "Co-Pilot active — individual lesson AI tools are disabled." / "Builder active — section AI tools are available."
- Choosing Co-Pilot opens the Co-Pilot dock (as today). Choosing Builder closes the dock.
- The choice is remembered per teacher (local, per browser) so the workspace opens in the mode they last used. Default stays Builder, so nothing changes for existing habits until they switch.
- Switching modes never touches lesson content — no regeneration, no deletion.

## 2. What Co-Pilot mode hides

While Co-Pilot is active, every per-section AI control disappears so the note reads cleanly (`Summary`, not `Summary ✨ AI`):

- The ✨ AI chip beside Introduction, Explanation, Example, Exercise, Classwork, Homework, Summary, Solution and custom sessions — including its Regenerate / Paraphrase / Extend / Clear actions.
- The "AI Edit" button in the selection bubble (Copy · Cut · Delete · Duplicate · Comment stay).
- The inline AI generate affordance on empty blocks.

Non-AI controls stay exactly as they are: **Floating**, **Assign**, **Smart Card**, drag-to-move sessions, insertion menus, and all object tools.

Nothing is deleted from the app — these controls return the moment Builder is selected.

## 3. What Co-Pilot gains

- Selection awareness: when the teacher highlights a Summary or Solution and types "rewrite this more simply", the highlighted section is handed to the Co-Pilot as the target, so it edits that section rather than guessing.
- The existing Co-Pilot procedure (greet → structure → material → analysis → build → supervision), proposal-then-approval, question-lock, inheritance and one-question-one-diagram rules are unchanged.

## 4. Builder mode

Builder is the existing environment: section AI chips, AI Edit, and the current generation paths all behave exactly as they do today. The Co-Pilot dock is closed in this mode, so the two never operate on the same lesson at once.

## Technical notes

- New tiny store `src/lib/lessonnotes/aiMode.ts`: `"copilot" | "builder"`, backed by `localStorage` and read through `useSyncExternalStore` so ProseMirror node views (rendered outside the page's React tree) see the same value without prop threading.
- `src/pages/NotebookEditorPage.tsx`: replace the Co-Pilot toggle with a `DropdownMenu` mode selector; derive `copilotOpen` from the mode; render the mode notice line.
- `src/components/lessonnotes/extensions/SectionHeading.tsx`: wrap the `AiPopover` block in `mode === "builder"` (keep Floating / Assign / Smart Card unconditional).
- `src/components/lessonnotes/SelectionToolbar.tsx`: hide the AI Edit button in Co-Pilot mode; in that mode `DocumentEditor` forwards the current selection snapshot to the Co-Pilot bridge as the active target.
- `src/components/lessonnotes/DocumentEditor.tsx`: gate the inline empty-block AI decoration on Builder mode; expose the selected section ref through the existing Co-Pilot bridge (`snapshot()` already carries `focusedRef` — add the selection-derived ref).
- No schema changes, no edge-function changes, no new generation path.

## Verification

In the preview on a real note: switch to Co-Pilot and confirm every ✨ AI chip and AI Edit button is gone while Floating/Assign remain and content is unchanged; highlight the Summary, ask Co-Pilot to simplify it, and confirm it proposes against that exact section and applies on approval; switch back to Builder and confirm the chips return with the lesson intact.
