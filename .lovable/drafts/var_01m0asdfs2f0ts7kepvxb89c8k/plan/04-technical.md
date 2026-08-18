## Technical notes

**Panel** — `src/components/lessonnotes/copilot/CoPilotPanel.tsx`, lazy-loaded and rendered beside the editor in `src/pages/NotebookEditorPage.tsx` (flex row: editor `flex-1`, panel fixed `33%` with a drag handle, hidden when closed). The button lives in the page header next to Present. Voice notes reuse `useVoiceInput`; the composer reuses `AutoTextarea`.

**Conversation state** — `src/lib/lessonnotes/copilot/conversation.ts`: message list (`role`, `text`, optional `proposal`, optional `run`), mode (`plan` | `create`), and the pending proposal. In-memory per note for this build (persisting the transcript is a later step).

**Context** — `src/lib/lessonnotes/copilot/snapshot.ts` builds the turn payload from `buildSessionContext` (`src/lib/lessonnotes/ai/sessionContext.ts`) plus the lesson AI context store (`src/lib/lessonnotes/aiContext.ts`) and the tool manifest (`ai/toolManifest.ts`). Read-only; no new derived state.

**Editor bridge** — `DocumentEditor` exposes a stable imperative handle (`src/lib/lessonnotes/copilot/actions.ts` types it): `snapshot()`, `insertSection`, `generateQuestion`, `generateSolution`, `insertDiagram`, `useExistingDiagram`, `buildGeometryMap`, `insertSmartTable`, `createSlide`, `insertAsset`, `editBlock`. Each is a thin wrapper over the handler that already exists in `DocumentEditor.tsx` (`insertSection`, `persistAndOfferFloating`, `offerGeometryMap`, `runAiEdit`, the pipeline calls) — no duplicated logic, no new generation path. The page wires the handle into the panel via a ref.

**Backend** — new `mode: "copilot"` in `supabase/functions/notebook-ai/index.ts`, reusing the existing standards imports (pedagogy reference, integrity/question-lock, inheritance, structural, rendering, workspace). Input: conversation history, mode, snapshot, manifest. Output is a single JSON object: `{ reply, proposal? }` where `proposal` = `{ summary, preserves[], steps[], actions[] }` and each action is one of the bridge names with typed arguments. PLAN mode is instructed never to emit an action; CREATE mode may, and destructive actions are flagged `confirm: true`. Unknown action names are rejected client-side.

**Execution** — `runProposal` in the panel walks `actions[]` sequentially, rendering the step checklist and calling the bridge. A failed step stops the run, names the step, and leaves earlier steps applied; the note's own undo history covers rollback.

**Verification** — in the preview on a real note: ask a question in PLAN mode (expect analysis, no change); "make Example 2 harder" in CREATE mode (expect a proposal naming the real Example 2, its question and its existing solution, then a stepped run that replaces only that block); "map this solution" (expect the existing Geometry Map on the existing diagram, no second diagram); "generate the solution" on a question that already has one (expect it to say so rather than duplicate).
