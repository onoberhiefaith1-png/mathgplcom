# Aura: instant replies, one voice, understood meaning

Two things change: Aura answers the moment you stop speaking, and what she reasons from is your *meaning*, not the raw words the microphone guessed.

One note on cost first: a paid "realtime voice" service would give the lowest possible delay, but it is the thing we already ruled out (hundreds of pounds a month per heavy user). Everything below uses what you already pay for, so a full day of talking stays at pennies. If you ever want to compare the paid route, say so and I will price it before building.

## 1. Two brains, one voice

- **Fast responder** (cheap model, tiny prompt, no tools): the instant you finish speaking it produces one short natural line — an acknowledgement, a question back, or the whole answer when the question is small. This is spoken immediately.
- **Deep worker** (the existing brain and the lesson-note generator): runs in the background for real work — lesson notes, mathematics, exploring the system, research, multi-step jobs.
- Only **one** of them ever reaches your ears at a time. The responder's line plays first; when the worker's result arrives Aura continues in the same voice, in the same turn. Never two voices, never a repeated answer.
- Small talk and simple questions never reach the deep worker at all, which removes both the wait and the spend.

## 2. Meaning before response

New step between the microphone and Aura:

```text
voice -> recognition -> cleanup -> meaning reconstruction -> Aura
```

- The existing cleanup (fillers, stutters, repeats, foreign-script mishearings) stays.
- On top of it, a very cheap reconstruction pass uses the last few turns to repair mangled words, finish fragments, and state the request as a clear sentence. Maths and MathGPL wording ("floating numbers", "smartboard", "session") get repaired against the real vocabulary of the app.
- Aura reasons from the reconstructed sentence only. The raw transcript stays visible and editable on screen, so nothing is hidden and you can correct it.
- When a later sentence shows an earlier one was misheard or badly worded, Aura re-reads the intention rather than obeying the broken wording.
- Genuinely ambiguous input gets one short question back, not a guess.

## 3. Interruption and cancellation

- Talking over her already stops her voice; that is kept and made complete: the interruption also **cancels the deep worker in flight**, so a superseded job never arrives late and speaks over the new instruction.
- A request you replace mid-way is dropped, not queued.
- Her turn ends cleanly if a background job fails — she says so plainly instead of going silent.

## 4. Compact, persistent conversation

- Instead of resending the whole conversation each turn, Aura keeps a short running brief: who you are, the workspace, what is open, the last few exchanges, and the current job. The full history stays on screen and in the record.
- The brief is refreshed, not rebuilt, so cost per turn stays flat no matter how long you talk.

## 5. Proof, measured not claimed

Timestamps captured per turn and shown under "Cost today": end of your speech, first text, **first spoken word**, result complete, and what the turn cost. Target: first spoken word well under a second; result whenever the work genuinely takes.

## Technical notes

- New `src/lib/agent/fastReply.server.ts`: one-shot cheap-model call, no tools, hard token cap, streamed.
- New `src/lib/agent/meaning.server.ts` + tests: reconstruction over the compact brief and an app-vocabulary list, falling back to the cleaned transcript on any failure.
- `src/routes/api/aura-turn.ts` emits the fast line first, then the deep turn on the same SSE stream (`type: "quick" | "delta" | "done"`), with an abort path bound to barge-in.
- `speechQueue`/`voiceSession`: unchanged behaviour, plus a single "reply in progress" owner so quick line and deep result share one playhead.
- `AuraProvider`: rolling brief, in-flight job handle, cancel on barge-in, latency marks into `callMetrics`.
- Untouched: Aura's voice and TTS model, the lesson-note contract and QUESTION_LOCK, Floating Numbers, Smartboard, Game behaviour, attachments, the input bar and plus button, saved teacher designs.
