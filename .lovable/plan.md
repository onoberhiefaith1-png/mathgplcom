# Aura Call: a real live conversation, plus the two microphone faults

Three problems, one plan.

## 1. Call and Record become genuinely different things

Today both buttons use the same browser listening, so "Call" behaves like a recorder. They separate completely:

**Record (microphone button)** — unchanged in spirit: you speak, you stop, she thinks about what you said and answers. One message at a time.

**Call (blue button)** — a real-time conversation run by a dedicated live-voice service:

- You tap once. A call opens and stays open.
- She hears you continuously and works out when you have finished a sentence.
- She answers out loud within a fraction of a second of you finishing.
- The moment you start talking again, her voice stops instantly and she listens.
- Nothing is sent, nothing is pressed between turns. Only the End button closes the call.
- Everything said appears in the same conversation, so text and voice share one history, and anything she does while talking (writing a note, creating a class) shows as the same step cards you already see.

During a call, the browser's own listening is switched off entirely. It is the source of both faults below, so on a call it is simply not used.

## 2. The microphone never asks again

The browser's listening engine on phones ends and restarts constantly, and each restart was being read as lost access. Fixes:

- Consent is remembered permanently on the device. Logging out and back in never clears it.
- Before any permission panel is shown, the browser's current permission is read. If it is already granted, listening simply resumes — no panel, ever.
- Routine endings, silence timeouts and restarts are treated as normal lifecycle events, never as failures, so "I lost the microphone" cannot appear because of them.
- One shared microphone owned by one controller, reused by Record, wake word, the call, and the animated meter. Detaching the meter never closes the microphone.
- Locking the phone, switching apps or changing network pauses cleanly and resumes when you come back.
- The restore-access message appears only when the browser genuinely blocks or you remove access yourself.

## 3. Whole sentences, never just the last words

Record currently shows only the newest fragment — "let's go" is replaced by "come home". Fixes:

- Everything heard in a turn is added together, never replaced, from the first word to the last.
- A turn only closes once the listening engine has delivered its final words, so a turn can no longer be cut mid-sentence by the silence timer.
- Her own voice is filtered out of your words without wiping what you already said.
- On a call, turn detection comes from the live-voice service itself, which hears whole sentences by design.

## What does not change

The input bar, the plus attachment button, the wake word, spoken-replies toggle, teaching out loud, her platform abilities, the mathematics rules, lesson notes, Smartboard, Floating Numbers and the Game.

## Cost note

A call uses the live-voice service by the minute while it is open, on top of her normal usage. The panel will say plainly when your allowance is running low, and the call ends rather than silently continuing.

## Technical notes

- **Connector.** Link the ElevenLabs connector so `ELEVENLABS_API_KEY` is available server-side. Never exposed to the browser.
- **Call transport.** A short-lived signed session is minted by a new server route (`src/routes/api/aura-call.ts`) which requests a conversation token from ElevenLabs; the browser opens the realtime socket with that token only. Microphone audio in, agent audio out, with the provider's own turn-taking and barge-in.
- **Agent brain stays MathGPL's.** The live agent is configured to call back into Aura for every turn, so `openai/gpt-6-astra`, the system prompt, approved `aura_knowledge`, the tool manifest, permissions and usage limits remain the single path. The live service provides ears, voice and turn-taking only — it never answers mathematics itself.
- **New module** `src/lib/agent/callSession.ts`: connect/disconnect, token refresh, mic handoff, transcript events, agent-speaking events, interruption, error mapping. `voiceSession.ts` is retained for the Record path and as the fallback when the live service is unavailable.
- **Mic ownership.** `micPermission.ts` gains a durable consent record plus `ensureMicrophone()` that re-reads permission before prompting; `useListening.ts` stops counting `onend`/`no-speech` as failures, keeps its analyser separate from the track, and pauses/resumes on `visibilitychange`. The call suspends `useListening` while connected.
- **Transcript accumulation.** Turn text is built from accumulated final results plus the current interim, and the end-of-turn gate waits for a final result before closing.
- **Errors.** Provider 401/403/429 and credit states surface as a plain message in the call strip; the call ends rather than retrying in a loop.

## Verification

- Unit tests for permission restoration, shared-stream reuse, meter cleanup without track shutdown, normal restart handling, transcript accumulation across pauses, and call connect/interrupt/end.
- Manual mobile check: a two-minute call with repeated silences, talking over her mid-sentence, locking the phone and returning, and logging out and back in — no permission panel, no dropped microphone, no truncated sentences.
