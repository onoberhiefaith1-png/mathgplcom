## Goal

The Floating Number AI must actually apply every law in the backend — not just read their names. When you type an equation like `3x² + 5x + 1 = (x+1)(x²+x+1)`, it must split on the visible arithmetic signs (Law 1), shell the brackets (Law 2), and never emit a chip like `(x+1)(x²+x+1)` that hides signs inside.

Right now the AI sees law *names* and *rules*, but most laws have 0–2 examples and the AI is never forced to demonstrate them. The fix is: **every law gets worked examples, the assistant loads them all, and runs a silent self-check before answering.**

---

## Plan

### 1. Worked-example field on every law

Every row in `floating_law_library` already has an `examples` JSONB column. Today most laws have it empty or with a single string. Standardise it to a structured worked-example shape:

```json
{
  "input": "3x² + 5x + 1 = (x+1)(x²+x+1)",
  "elements": ["3", "x²", "+", "5x", "+", "1", "=", "(", "x+1", ")", "(", "x²+x+1", ")"],
  "chips": ["3x²", "5x", "1", "=", "()", "()"],
  "containers": ["bracket", "bracket"],
  "why": "Law 1 splits on the top-level + signs. Law 2 shells each (...) so no chip hides interior signs."
}
```

Two examples per law, minimum. The teacher can add more from the Law page.

### 2. Seed the missing examples

Write one migration that backfills the existing laws with the canonical examples (using the verifier's own test cases as the source of truth — they already encode the correct chip output). Laws without examples are filled in; laws with hand-written examples are left alone.

### 3. AI hydration: send ALL laws with their examples (no truncation)

In `floating-assistant/index.ts` `formatLessonState`:
- Stop slicing approved laws to 30 — send every law that matches the topic.
- For each law, include all worked examples (up to ~4), not just 2.
- Add a top-of-prompt block: **"LAW DRILL — before answering, mentally run each law on the user's equation in order. If the equation matches any law's example pattern, the chip output must follow that example."**

### 4. Pre-answer self-check (silent)

Before the model produces the proposal:
- Add a new internal tool `self_check_chips` that takes `{input, chips, containers}` and runs the existing `verifyLine` from `floatingVerifier.ts`. Returns `{ok, failures}`.
- System prompt instruction: "Before calling `propose_line` or `replace_line`, you MUST call `self_check_chips`. If it returns failures, fix the chips and try again. Never propose chips that fail the verifier."
- This is the same verifier the UI uses, so the AI can't propose `(x+1)(x²+x+1)` as a single chip — `NoHiddenSign` will reject it and force it to shell.

### 5. Block bad proposals server-side (belt + braces)

In the `propose_line`/`replace_line` tool handlers, run `verifyLine` on the chips before persisting. On failure, return the failure list as the tool result instead of accepting — forces the model to retry within the same turn.

### 6. Law-by-law smoke test surfaced to teacher

In the Law page (`AiSettingsPage.tsx`), add a "Test this law" button on each law card. Sends the law's example `input` to the AI with instruction *"apply only this law"* and shows the returned chips next to the expected chips. Green = AI applied it correctly, red = drift. Lets the teacher see at a glance which laws the AI has internalised.

---

## Technical details

**Files touched**
- `supabase/migrations/<new>.sql` — backfill `examples` JSONB on `floating_law_library`.
- `supabase/functions/floating-assistant/index.ts`
  - `hydrateKnowledge`: remove `.limit(100)` cap to `.limit(500)`; remove the slice(0,30) in `formatLessonState`.
  - new `self_check_chips` tool wired to `verifyLine`.
  - `propose_line`/`replace_line` handlers: pre-verify before insert; return failures on reject.
  - system prompt: add LAW DRILL + mandatory self-check rule.
- `supabase/functions/floating-assistant/verifier.ts` already exists — reuse, no changes.
- `src/pages/floating/AiSettingsPage.tsx` — "Test this law" button + side-by-side chip diff.

**Non-goals**
- No schema change (column `examples` already exists).
- No new tables.
- Not touching `floating-reason` — same hydration pattern can be applied later if needed.
- Not retraining or fine-tuning a model — pure prompt + tool-loop fix.

**Risk**
- Prompt grows. Mitigation: examples are short (~120 chars each), and laws are filtered by `lesson_topics` already, so a typical topic loads ~10–20 laws → well within budget.
