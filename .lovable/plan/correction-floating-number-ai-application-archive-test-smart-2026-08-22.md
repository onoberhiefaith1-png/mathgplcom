# Correction: Floating Number AI, Application Archive, Test Smartboard

Four corrections. No rebuild of the Smartboard, marking, evaluation or Floating Number editor.

## 1. Floating Number AI leaves the active page (code kept)

The right-hand "Floating Number AI Assistant" panel on the Floating Number page stops rendering. Its component, edge functions, prompts and verifiers stay untouched in the codebase — it is retired, not deleted.

Visibility is driven by one archive switch, so nothing has to be re-coded to bring it back.

## 2. Application Archive on the admin dashboard

A new **Application Archive** card on the right-hand side of the platform console lists retired features:

```text
APPLICATION ARCHIVE
  Floating Number AI            [ Restore ]
```

The entry is named after the feature ("Floating Number AI") — never an equation, question or generated floating number. Restore flips the switch and the assistant reappears on the Floating Number page on next load. Archive again puts it back.

The existing per-line snapshot panel on the Floating Number page (the one that restores previously generated chip configurations) stays where it is — it is a different, content-level tool.

## 3. Test Smartboard matches the teacher-view screenshot

The board opened from Floating Number → Test on Smartboard keeps the full teacher evaluation surface, exactly as in the reference screenshot:

- question, student-style workspace, live writing, automatic marking
- right panel: QUESTION · LINE, EXPECTED LINE, STUDENT LINE (LIVE), AI EVALUATION, STUDENT-INTRODUCED TERMS
- updates live while the teacher solves — no submit step

Differences in test mode:

- **No View Only / Edit Mode controls** — the teacher is not visiting a real student's workspace.
- Bottom bar reads: `Back · Viewing: Test · Evaluation` plus the existing Restart / Exit test controls.
- The word **Reasoning** becomes **Evaluation** everywhere it is still visible (button label and titles). Logic unchanged.
- Question-scoped: one question per sitting, fresh state per entry, nothing saved — no submission, no student progress, score or class-progress change.

## 4. Smartboard clean-up and draggable sensor pad

- **Remove the emoji button** from the Smartboard entirely (the one added last time near the dustbin control). No replacement icon, no relocation. All other Smartboard controls untouched.
- **Sensor D-pad becomes draggable**: same five keys, same design, same behaviour and auto-hide. Pressing and dragging the **centre key** moves the whole pad left/right (and vertically) so it can be parked under one thumb on a phone; a tap without movement still works as the centre action. The position persists for the session.

## Technical notes

- `src/pages/FloatingNumbersPage.tsx`: the `<aside>` hosting `AssistantPanel` renders only when the feature is active; import and component file remain.
- New `public.archived_features` table (feature key, archived flag, timestamps) with grants + RLS: read for authenticated, write for platform owner/admin only; seeded with `floating_number_ai` archived. A small `useArchivedFeature('floating_number_ai')` hook reads it.
- `src/pages/accounts/AdminConsole.tsx`: new right-side Application Archive card, restore/archive actions.
- `src/pages/floating/FloatingTestBoardPage.tsx`: bottom bar gains `Viewing: Test` + `Evaluation` toggle mounting the existing `TeacherReasoningPanel` (already labelled "Evaluation"); `PresentationView` in `testMode` hides View Only / Edit affordances.
- `src/components/smartboard/BoardEmojiDock.tsx` usage removed from `PresentationView.tsx`.
- `src/components/smartboard/SensorDPad.tsx`: pointer-drag on the centre button offsets the portal container, reusing the existing drag-offset pattern from `useDraggableTab`.
