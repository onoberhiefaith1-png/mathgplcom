# Aura Call: under one second, talks while she thinks, and shows every word you said

Three things to fix: the long wait before she answers, her starting to speak only when the whole answer exists, and the screen showing only the first few words you said.

## 1. Measure the delay honestly before changing anything

Nothing gets "felt faster" — it gets timed. A call records four stamps for every turn:

- the moment your words are closed off,
- the moment her first written word arrives,
- the moment her first sound is actually heard,
- the moment she stops speaking.

These appear in a small developer read-out on the call strip (teacher-only, hidden for students) and are reported to you as real numbers after a test call. Target: first audible sound under one second for ordinary conversation. No filler sounds, no "hmm" padding — if it is slow, the number says so.

## 2. Remove what is actually costing the 30 seconds

Measured at the four stamps above, in this order:

- **Her thinking pass.** On a call she thinks at the lightest setting and her private reasoning notes are no longer requested at all, because they are never shown and only delay the first word.
- **Her briefing is built once per call, not once per sentence.** The system briefing and your approved training notes are currently rebuilt and re-fetched from the database on every single turn. On a call they are prepared when the call opens and reused for the whole call.
- **Her abilities are loaded in two tiers.** During a call she carries a small everyday set of abilities. The moment a turn genuinely needs the full set (writing a lesson note, creating a class, assigning), that turn switches to the full set and she says one short line while it happens. Permissions and confirmation checks are untouched — assignment and anything destructive still need your clear agreement.
- **Her voice is warmed up.** The speech connection is opened when the call starts, so the first clause does not pay connection time.
- **No background requests during a call.** Page snapshots and screen context are gathered once per turn at most, not repeatedly.

If the measurements show her thinking pass alone cannot come under one second, I will report the exact number and ask you before changing anything about which brain answers spoken small talk. Nothing is swapped silently.

## 3. She talks while she is still writing

She already begins on her first clause, but the cut is too cautious, so the first sound waits for a fairly long phrase. Changes:

- The first thing she says is cut at the first natural break — a comma, "so", "right", a dash — as short as a few words, so sound starts almost immediately.
- Later clauses are cut longer, so she sounds like a person and not a stutter.
- While clause one is heard, clause two's audio is already being fetched, and clause three queues behind it. Her writing runs far ahead of her voice, exactly as ChatGPT does.
- If she finishes writing before she finishes speaking, the queue simply drains — nothing is dropped and nothing is repeated.

## 4. Turn-taking by loudness, the way you described it

Background noise never disappears, so the decision is relative, never absolute:

- When the call opens, she measures the room for a moment and learns its own noise level.
- Your voice is "speech" while it stands clearly above that level; the room is "quiet" when it falls back near it.
- When it has stayed near the room level for a natural pause and real words were heard, she answers — no button, no tap.
- The moment your voice rises above that level again while she is speaking, her voice stops mid-word and she listens. Her own voice through the loudspeaker is measured and discounted, so she never interrupts herself.
- The pause she waits for shortens as the call goes on and she has learned your rhythm, and lengthens again in a noisy room.
- She also waits for the listening engine to hand over its finished words, so a sentence can never be cut in half by the pause timer.

What Grok and ChatGPT add on top, and we will too:

- A very short, natural gap before she begins, so she does not step on your last syllable.
- If you start again within that gap, the turn is cancelled and your words simply continue — you are not answered twice.
- Short acknowledgement turns ("mm-hm", "okay") are recognised and not treated as a question needing an answer.

## 5. Everything you said, on screen, scrollable and editable

Today the heard words are squeezed into one line and cut with dots, so "I went to school this morning, I ate breakfast, and I took a cab" shows as "I went to…". Instead:

- A five-line panel shows your words as they are heard.
- New words arrive at the bottom and earlier lines scroll up on their own.
- You can scroll back through everything said in that turn.
- You can tap it and edit the text before it is sent, and sending resumes automatically.
- While she is answering, the last thing you said stays visible above her reply.
- Every word still lands in the same conversation, with the same step cards for anything she does.

## What does not change

Her voice and its warmth, the input bar, the plus attachment button, the wake word, spoken-replies toggle, teaching out loud, her platform abilities, the mathematics rules, lesson notes, Smartboard, Floating Numbers and the Game. No new voice vendor, no per-minute bills.

## Technical notes

- **Timing.** New `src/lib/agent/callMetrics.ts`: `mark(turnId, stage)` for `turnClosed`, `firstToken`, `firstAudio`, `speechEnd`; kept in memory, surfaced in the call strip behind a teacher-only flag and logged once per turn.
- **Latency work in `brain.server.ts`.** For `{call: true}`: drop `reasoningSummary`/`include: reasoning.encrypted_content`, keep `reasoningEffort: "low"` (Astra requires reasoning; `none`/`minimal` are rejected), keep the model `openai/gpt-6-astra`. Add a cached per-session system briefing so `buildAgentSystemPrompt` + `learnedKnowledgePrompt` run once per call, not per turn; add a `tier` on `AGENT_TOOL_MANIFEST` entries and pass only the conversational tier on call turns, escalating to the full manifest when a tool in the reduced set reports "needs full abilities". `stopWhen: stepCountIs(50)` stays for escalated turns, reduced for plain talk.
- **First-clause cut.** `takeClauses` in `speechQueue.ts` gains a `first` mode with `MIN` around 6 characters and connective breaks, then falls back to the current longer cut; queue prefetch depth 2.
- **Speech warm-up.** `SpeechQueue` opens the shared `AudioContext` and issues a zero-length priming request to `/api/aura-speech` on `startVoice`.
- **VAD.** `voiceSession.ts`: calibration window on `begin()`, adaptive `endOfTurnMs` (narrowing from 900ms toward ~450ms as turns confirm), a pre-answer grace window that cancels the turn if speech resumes, and an acknowledgement filter on very short transcripts.
- **Transcript panel.** `AuraCockpit.tsx` replaces the `truncate` line with a five-line scroll region (auto-scroll to bottom, `overflow-y-auto`, max-height ≈ 5 lines) that becomes a textarea on tap, writing back through `listening.setTranscript`; `useListening` exposes a setter so an edit replaces the accumulated final text.
- **Tests.** `callMetrics` staging; first-clause vs later-clause cutting; calibration, adaptive pause, grace-window cancel, self-voice rejection; transcript accumulation survives edit and resume.

## Verification

- A real two-minute call on your phone: talk over her, pause mid-sentence, lock the screen and return.
- The four measured numbers reported to you as-is, including the worst turn, with no rounding down.
