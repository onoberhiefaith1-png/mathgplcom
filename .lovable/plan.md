
## Goal

Stop trying to make the AI generate perfect floating numbers. Reframe it as the **fastest way to correct** the structures the generator already produces. The teacher speaks, edits the text, hits send, sees a preview, applies.

---

## Plan

### 1. Voice → live editable text (ChatGPT-style)

Replace the current WhatsApp-style "record → attach audio blob" flow with live streaming dictation that fills the input box.

- **Backend**: new edge function `speech-transcribe` that proxies to Lovable AI `openai/gpt-4o-mini-transcribe` with `stream: "true"` (per the `ai-speech-to-text` knowledge). Returns SSE.
- **Frontend (`AssistantPanel.tsx`)**:
  - Replace `MediaRecorder → blob → base64 attachment` with chunked recording that streams to `speech-transcribe`.
  - As `transcript.text.delta` events arrive, append into the `input` textarea live. On `transcript.text.done`, leave the cursor at the end so the teacher can edit before pressing Send.
  - Mic button toggles record/stop; stop finalises whatever is in the box.
  - Drop the audio-attachment chip UI and the `audio: {...}` field in the `floating-assistant` invoke body. **No audio is stored.**
- Remove the audio-handling branch in `supabase/functions/floating-assistant/index.ts` (text-only from now on).

### 2. Selection-aware editing

The assistant already receives `selection` and `lineId` via `activeHighlight`. Make this first-class:

- In `AssistantPanel`, when a chip is highlighted, show a persistent "Editing: `5x` in line 3" badge above the input.
- In the system prompt (floating-assistant), add: *"When the user says 'this', 'that', 'it', 'here', resolve to the current selection chip and line. Never ask the user to repeat what they highlighted."*
- Pass the chip's container/position index along with the text, so the model can target a specific filler instead of guessing by substring.

### 3. Natural-language edit command vocabulary

The model already has `apply_line_update` with ops `move_filler | add_filler | remove_filler | add_container | remove_container | set_arrangement | replace_line`. Wire the vocabulary to it.

- **System prompt addition** in `floating-assistant/index.ts`: an "EDITOR MODE" section listing the teacher phrases and the op each maps to:
  - "remove bracket / delete container" → `remove_container`
  - "add bracket / wrap in brackets" → `add_container`
  - "move 5x to container 2 / move this left/right" → `move_filler` (with `from_index`/`to_index`)
  - "insert empty box / add filler" → `add_filler`
  - "merge containers" / "split container" → `set_arrangement`
  - "add exponent / add square root / convert to fraction / numerator / denominator" → `replace_line` with the rebuilt structure
  - "delete this / remove this term" → `remove_filler`
- Forbid the model from regenerating the whole line when a targeted op suffices. Prefer the smallest op that satisfies the request.

### 4. Preview-before-apply card

The pending-action card exists but currently approves blindly. Upgrade it:

- For every `apply_line_update` / `apply_chips`, render:
  - **Proposed Change** — one-line summary the model returns (`payload.reason`).
  - **Before** — current chips/containers (read from the page state already in scope).
  - **After** — chips/containers post-op, computed client-side by applying the op to the current line.
  - Three buttons: **Apply**, **Cancel**, **Modify** (Modify re-opens the input pre-filled with the previous prompt + "make it …").
- Compute the "After" preview in a new pure helper `src/lib/floating/previewOp.ts` so the teacher always sees the exact resulting structure, not just the op name.

### 5. Reframe the welcome + quick actions

- Change the welcome copy to lead with editing: *"I'm your editor for floating numbers. Highlight a chip, tell me what to change, and I'll show you a preview before applying."*
- Replace `QUICK_ACTIONS` with editor-first chips: *Remove bracket · Add bracket · Move term · Add exponent · Convert to fraction · Split container · Merge containers · Undo*.
- Keep "Generate" available but demoted — it's a secondary action, not the headline.

### 6. Trim the now-unused audio path

- Remove `recorderRef`, `chunksRef`, `blobToBase64`, `audio` attachment UI, and the `audio` branch in the edge function.
- Keep document attachments (`.pdf`, `.docx`, `.txt`) as-is — those are separate.

---

## Technical details

**Files touched**
- `supabase/functions/speech-transcribe/index.ts` — new SSE proxy (per `ai-speech-to-text` knowledge).
- `supabase/functions/floating-assistant/index.ts` — drop audio handling; add EDITOR MODE prompt block; tighten selection resolution rules.
- `src/components/floating/AssistantPanel.tsx` — live STT into the input box, selection badge, new welcome + quick actions, preview card wiring, remove audio UI.
- `src/lib/floating/previewOp.ts` (new) — pure function `applyOp(currentLine, op) → nextLine` for the preview card.

**Non-goals**
- No new DB tables. No schema changes. No model fine-tuning.
- Generator code is untouched — this is purely the assistant surface.
- The existing `propose_line` / law-drill / verifier work from the previous thread stays in place; we are layering an editor mode on top, not replacing it.

**Risk**
- Streaming STT needs mic permission to be re-prompted per session in some browsers. Mitigation: show a clear permission toast and fall back to one-shot transcription if streaming fails.
- Live transcript can land mid-typing. Mitigation: when recording starts, append at the current cursor position; when it stops, place the cursor at the end of the dictated span.
