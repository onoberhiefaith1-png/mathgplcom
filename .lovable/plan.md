## Goal

Turn the Floating Number AI from a narrow tool-only assistant into a full general-purpose ChatGPT/Claude-style AI that *also* has deep Floating Number expertise — without losing law-grounding, approval-gated edits, or the existing tool pipeline.

## Changes

### 1. Rewrite the system prompt (`supabase/functions/floating-assistant/index.ts`)

Replace the current `SYSTEM_PROMPT` with a dual-mode prompt:

- **Identity:** "You are the Floating Number AI — a full general-purpose assistant (like ChatGPT/Claude) with deep specialization in the Floating Number system, mathematics, and lesson design."
- **Always allowed:** answer any question, write stories, brainstorm, design games, explain concepts, summarize/compare/analyze uploaded documents, discuss laws in plain English, do general math, write code, etc.
- **Specialization triggers:** when the user asks for chip generation, verification, applying chips, restructuring an expression, or proposing a law, use the existing tools (`analyze_example`, `generate_chips`, `verify_chips`, `lookup_law`, `propose_new_law`, `apply_chips`, `undo_last_change`) and follow the QUESTION_LOCK / law-grounded rules already in place.
- **Tools are optional:** for general conversation, answer directly without invoking tools. Never refuse a request just because it isn't Floating-Number-related.
- **Knowledge access:** keep Official Laws, Draft Laws, Knowledge Docs, lesson context, and current selection injected on every turn (as they already are) and tell the model it may freely cite or ignore them based on what the user asked.

Keep `tool_choice: "auto"` (already set) so the model decides when to call tools.

### 2. Improve error handling

**Backend (`supabase/functions/floating-assistant/index.ts`):**
- Map gateway/runtime failures to structured errors with a `code` and friendly `message`:
  - `rate_limited` (429) → "The AI is busy — please retry in a few seconds."
  - `credits_exhausted` (402) → "AI credits exhausted for this workspace."
  - `payload_too_large` (413 / body > ~8 MB) → "Document too large — please upload a smaller file or split it."
  - `unsupported_format` (unknown mime) → "Unsupported file format. Try PDF, DOCX, TXT, or MD."
  - `context_limit` (gateway 400 mentioning context/tokens) → "Conversation or document too long — start a new chat or shorten the document."
  - `upstream_unavailable` (5xx) → "AI service temporarily unavailable. Please retry."
  - `internal_error` (default) → include the raw message for diagnostics.
- Return `{ error: { code, message, detail? } }` with the appropriate HTTP status instead of a bare string.

**Frontend (`src/components/floating/AssistantPanel.tsx`):**
- In the `send` catch block, read `error.context?.body` / `data.error` for the structured shape and display the friendly `message` (and `detail` if present) instead of the generic "Failed to send request to Edge Function".
- Show the same friendly text inline in the assistant bubble.

### 3. No schema, no DB, no UI layout changes

- Tool definitions, lesson-context hydration, law/draft/document loading, approval cards, sidebar layout, voice input, and attachments stay exactly as they are.
- This is a prompt + error-handling change only.

## Files touched

- `supabase/functions/floating-assistant/index.ts` — new system prompt; structured error responses.
- `src/components/floating/AssistantPanel.tsx` — parse and display structured errors; update the welcome message to reflect general-purpose capability.

## Verification

- Ask a non-math question ("Write a short story about a triangle") → gets a real answer, no tools called.
- Ask "Generate floating numbers for x²+5x+6" with a highlight → tool pipeline runs and proposes an approval card as before.
- Upload a PDF and ask "Summarize this and extract any laws" → AI responds with summary + optional `propose_new_law` calls.
- Force a failure (oversized payload) → see the friendly "Document too large" message, not a raw Edge Function error.
