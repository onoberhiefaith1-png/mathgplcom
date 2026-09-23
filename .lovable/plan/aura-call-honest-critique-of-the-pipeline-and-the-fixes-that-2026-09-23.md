# Aura Call: honest critique of the pipeline, and the fixes that make it feel like a real call

The pipeline we discussed is the right economic choice — her existing voice, no per-minute vendor. But as it stands today the code cannot feel like ChatGPT or Grok voice mode. Below is what is actually wrong, measured against the real files, and exactly how each fault is removed.

## Where the current pipeline breaks

**1. She waits for the whole answer before she opens her mouth.**
Today her reply is only spoken once the full turn has finished arriving. With thinking on, that is several seconds of dead silence after you stop talking. A call dies at that moment. This is the single biggest flaw.

**2. Each sentence pays the voice queue twice.**
Sentences are spoken strictly one after another, and each one only asks for its audio when the previous one has finished playing. So between every two sentences you hear the gap of a fresh voice request. It sounds like a machine reading, not a person talking.

**3. A new audio device is opened and thrown away for every sentence.**
That costs startup time on every sentence and, on phones, is exactly what causes clipped first words and a voice that will not start at all after the screen has been locked.

**4. Turn-end is decided by fixed loudness numbers.**
One fixed "this is speech" and "this is quiet" level cannot be right in a quiet bedroom and a noisy classroom on the same phone. Too low and traffic noise means she never believes you stopped; too high and she cuts you off mid-sentence.

**5. She listens to her own voice.**
While she speaks, the same microphone is open, and the phone's loudspeaker feeds straight back into it. So either she interrupts herself, or the interruption threshold is set so high that talking over her does not work. Both are happening.

**6. Turn-end ignores the listening engine's own opinion.**
The turn closes on a timer, not on the engine having delivered its final words. That is the truncation you saw — "let's" sent while "let's go, come home" was still being resolved.

**7. There is no floor on how long a turn may be.**
One word said into a noise spike becomes a turn. Real call systems require both real speech and real words before they answer.

## The corrected pipeline

```text
your voice ──> one permanent microphone ──> live words (accumulated)
                       │                            │
                  noise-calibrated VAD  +  engine's final-words signal
                       └────────────── turn closes ──┘
                                          │
                              Aura answers, streamed
                                          │
              first clause spoken while the rest is still being written
                                          │
              one audio device, kept open, sentences queued ahead of time
                                          │
              you speak over her ──> her voice stops within a breath
```

### Step 1 — She speaks before she has finished thinking
Her answer is consumed as it streams. The moment the first clause exists, it goes to her voice. Target: she begins speaking well under a second after your turn closes, instead of after the whole answer. Clause boundaries, not only full stops, so the first sound comes even sooner.

### Step 2 — Voice requests run ahead of playback
While sentence one is playing, sentence two's audio is already being fetched. The queue keeps one sentence in flight at all times, so there is no seam between sentences.

### Step 3 — One audio device for the whole call
A single audio output is opened when the call starts, unlocked by that same tap (which is what phones require), and reused until the call ends. No more clipped first words, no more silence after a screen lock.

### Step 4 — The microphone calibrates itself
For the first moment of the call she measures the room's own noise, and speech/quiet are set relative to that floor, then kept adjusting slowly. A noisy room and a silent one both work.

### Step 5 — She stops hearing herself
Her own output level is tracked and subtracted from what the microphone hears, so only speech clearly above her own voice counts as you talking over her. Combined with the phone's echo cancellation, talking over her works reliably and she never interrupts herself.

### Step 6 — Turns close on words, not only on time
A turn closes when the room has been quiet long enough **and** the listening engine has delivered its final words. Everything heard in the turn is added together from the first word to the last — never replaced. If the engine is slow, a longer safety limit still closes the turn, using everything accumulated.

### Step 7 — Interruption is instant and remembered
Speaking over her stops her voice mid-word, empties the queued sentences, and the sentence you just started becomes the next turn. What she already said stays in the conversation, so "no, the other part" makes sense to her.

### Step 8 — Call and Record stay different
Record: you speak, you stop, she answers — one message. Call: opens once, stays open, no button between turns, only End closes it. Both write into the same conversation, and anything she does during a call still appears as the same step cards.

### Step 9 — Cost and safety guards
The call ends itself after a stretch of genuine silence, and there is a maximum call length with a "Continue" tap. Her thinking effort during a call is kept at its lightest so answers start fast, and her spoken replies are kept short and conversational while the full written answer still appears in the chat.

## What stays exactly as it is

Her voice and its warmth, the input bar, the plus attachment button, the wake word, spoken-replies toggle, teaching out loud, her platform abilities, the mathematics rules, lesson notes, Smartboard, Floating Numbers and the Game. No new vendor, no per-minute billing.

## Technical notes

- **Streaming reply to voice.** `AuraProvider.send` currently calls `speak(turn.reply)` after the turn resolves. During a call, consume the streamed text and feed a clause splitter (extend `takeSentences` with `,;:` and clause length) into the voice queue as deltas arrive.
- **Speech queue.** New `src/lib/agent/speechQueue.ts`: single shared `AudioContext` created on the call's user gesture, one in-flight `/api/aura-speech` fetch prefetched ahead of the playing sentence, scheduled on a continuous playhead, `flush()` for barge-in. `streamSpeech.ts` refactored to accept an injected context and return a decoded/scheduled handle instead of opening and closing its own context per call.
- **VAD calibration.** `voiceSession.ts` gains an adaptive noise floor (rolling percentile of the first ~600ms, then slow adaptation) with `speechLevel`/`silenceLevel` expressed as multiples of it, plus `selfLevel` passed in each `feed()` sample so barge-in compares against her current output level.
- **Turn gate.** `useListening` exposes `finalPending` (interim present, no final yet); `feed()` requires quiet + `minSpeechMs` + no pending final, with a hard `maxTurnMs` fallback. Accumulated finals are never cleared mid-turn.
- **Latency budget.** Reasoning effort `low` on the call path, short spoken-reply instruction in the call system prompt, clause-level first utterance — target first audio under ~1s after turn close.
- **Guards.** Idle hang-up after ~75s of no speech; max call length ~20 minutes with a Continue control; existing usage limits unchanged.
- **Tests.** `voiceSession` traces for noisy-room calibration, self-voice rejection, real barge-in, pending-final turn gating, accumulation across pauses; `speechQueue` tests for prefetch ordering, gapless scheduling and flush-on-interrupt.

## Order of work

1. Speech queue with one shared audio device and prefetch.
2. Streamed reply → clause splitter → queue (she talks while thinking).
3. Adaptive VAD, self-level barge-in, pending-final turn gate.
4. Call strip: states, End, Continue, idle hang-up.
5. Tests, then a real two-minute call on your phone: interruptions, silences, screen lock, log out and back in.
