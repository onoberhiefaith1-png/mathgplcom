## Technical detail

**Credit conversion (`src/lib/agent/spend.ts`)**
- Add `CREDIT_PENCE = 30` and `creditsOf(pence)`, plus `formatCredits(credits)` — `0.0` when zero, otherwise up to 5 decimal places with trailing zeros trimmed, so a tiny turn reads `0.00042` instead of `0`.
- `MODEL_RATES` keeps the published per-token rates already in the file; add `google/gemini-3.1-flash-tts-preview` (audio seconds) and the transcription model so voice turns are not silently free.

**Per-reply number**
- `brain.server.ts` already returns `usage` from measured tokens; `fastTurn.server.ts` returns its own. `src/routes/api/aura-turn.ts` already merges both into `turn.usage.pence` — extend the merge to carry `{ input, output, pence, credits }`.
- Speech (`speech.server.ts`) and transcription report their audio seconds back to the caller so `AuraProvider` can add them to the turn that produced them.
- `AuraProvider`: store `usage` on the assistant `AuraMessage` when the turn finishes (today it only feeds the daily ledger).
- `AuraCockpit`: render a small pill under each finished assistant message with `formatCredits`. Panel and full-page variants share the component. Nothing renders while a reply is still streaming.

**Making the ledger honest**
- `resource_prices` has rows for `ai.input_tokens` / `ai.output_tokens` / `ai.audio_minutes` with `unit_price` NULL, which is why `usage_events.cost_credits` is 0 for all 46 of today's AI events. Fill those rates (GBP per 1M tokens / per audio minute) for the models in use.
- `recordUsage` is not called for the fast brain, TTS or transcription — add those calls with `ai.input_tokens`, `ai.output_tokens`, `ai.audio_minutes`, so `/admin/usage-revenue` and the credit wallet match what the chat pill shows.

**Untouched:** Aura's voice and TTS model, `AGENT_MODEL` (`google/gemini-2.5-flash` via `lovable.chat`), `FAST_MODEL` (`google/gemini-2.5-flash-lite`), the lesson-note contract, QUESTION_LOCK, Floating Numbers, Smartboard, Game behaviour, saved teacher designs.

**Proof before I call it done:** run a real turn, read the recorded tokens back from the database, and check the pill on screen equals the priced value of those tokens.
