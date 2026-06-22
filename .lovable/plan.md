## Floating Number AI — Convert from Selection Viewer to Full Chat Assistant

Transform the right-side panel from a "selection inspector" into a real chat-style AI assistant (ChatGPT/Claude-like) that accepts highlights, typed prompts, voice, and document uploads — while keeping the ability to edit the Floating Number page after teacher approval.

### 1. Rebuild `AssistantPanel.tsx` around a chat surface

Remove:
- The "Current Selection" header strip, the Single/Multi segmented control, the pin/clear/remove controls, the stacked selection-list card, and the selection-summary metadata.

Replace with a 3-zone layout (white bg, black text — keep current readability rules):
- **Top bar (slim):** Title "Floating Number AI", Lesson topic chip, New chat / clear-history icon, Settings icon.
- **Middle (flex-1, scrolling):** Pure conversation transcript. User messages right-aligned (blue left-border), assistant messages left-aligned (neutral border). Inline-rendered:
  - Highlighted-context cards (when a turn was sent with a highlight) shown as a small "Context:" attachment chip above the user bubble, displaying the equation with `renderMathInline` so 2D structure (fractions, exponents, factored forms) is preserved exactly as on the page — NOT flattened, NOT split into lines.
  - Voice attachment chip (audio filename + duration).
  - Document attachment chip (filename + type icon).
  - Assistant "Proposed change" cards with **Show Preview → Approve / Reject / Modify** buttons that gate the existing `apply_chips` / `undo` / `approve_draft_law` client actions. No silent writes.
- **Bottom composer:** ChatGPT-style input row with:
  - Multi-line `<Textarea>` (auto-grow).
  - Paperclip → file input (`.pdf,.docx,.txt`).
  - Mic → `MediaRecorder` voice capture (webm) with record/stop toggle.
  - Send button.
  - Quick-action chips row directly under the composer (Explain, Generate, Verify, Restructure, Apply Law, New Law, Compare, Coverage) — these prefill/send the prompt; remove the standalone "Action Chips" box.

### 2. Highlight handling — preserve visual structure

In `FloatingNumbersPage.tsx`:
- Keep the existing `selectionchange` listener but simplify: a single active highlight at a time (no Single/Multi mode), stored as `activeHighlight: { text, lineId, html? } | null`.
- Capture both plain text AND the source line's rendered representation (re-render via `renderMathInline` from the captured text) so the chat attachment chip shows the equation looking like the page, not a flattened token list.
- Pass `activeHighlight` down as a single prop; on send, attach it to the outgoing message and clear it (or keep until user dismisses with an "x" on the chip).

### 3. Multi-modal input pipeline

Frontend (`AssistantPanel.tsx`):
- **Files:** read PDF/DOCX/TXT in the browser (TXT inline; PDF via `pdfjs-dist` already in `node_modules` if present, else upload bytes; DOCX via `mammoth` if present, else upload bytes). Fall back to base64 upload to the edge function.
- **Voice:** `MediaRecorder` → base64 webm → send as `audio` field.
- Send all of `{ message, highlight, attachments:[{kind, filename, mime, data}], audio, lessonContext, history }` to `floating-assistant`.

Backend (`supabase/functions/floating-assistant/index.ts`):
- Accept new fields. For audio, forward as `input_audio` content block (webm). For documents, forward as `file` content block (`application/pdf` / text) per `ai-multimodal-input`.
- Build the user message as a multimodal `content[]` array when any attachment is present; otherwise keep the current string path.
- Keep the existing tool-calling loop, lesson hydration, and law/draft logic untouched.

### 4. AI-edits-the-page flow (approval-gated)

- Keep the existing `apply_chips`, `undo_last_change`, `approve_draft_law`, `reject_draft_law` client actions returned by the edge function.
- In the new chat UI, render each `pendingActions[]` item as a "Proposed change" card inside the assistant message with:
  - **Show Preview** — expands an inline preview (chips + scaffolds) using the existing detector/verifier output already in `toolTrace`.
  - **Approve** — calls existing `onApproveApply` / `onApproveUndo` handlers (no schema or page-write changes needed).
  - **Reject / Modify** — dismisses the card / refocuses the composer with a follow-up prompt.
- No backend or migration changes for the write path — the wiring already exists; we're only changing how it's surfaced.

### 5. What stays the same

- Edge function tool set, lesson-context hydration, law library, draft-law approval, verifier — all unchanged.
- `FloatingNumbersPage.tsx` page rendering / compile flow — only the selection-state shape and the AssistantPanel props change.
- No new tables, no new migrations.

### Files

- `src/components/floating/AssistantPanel.tsx` — full rewrite around chat transcript + multimodal composer.
- `src/pages/FloatingNumbersPage.tsx` — replace `capturedSelections[] / selectionMode` with single `activeHighlight`; drop Single/Multi wiring; adapt props passed to AssistantPanel.
- `supabase/functions/floating-assistant/index.ts` — accept `attachments[]` and `audio`, build multimodal `content[]` for the gateway call; keep tools and prompts.

### Out of scope (ask later if wanted)

- Persisting chat history to the DB (currently in-memory per session — matches the rest of the app).
- New law-library schema work; existing draft-law approval flow is reused.
