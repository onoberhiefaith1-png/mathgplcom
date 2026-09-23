# Aura hears nothing while the wave still moves

## What is happening

Two different things listen in Aura today, and only one of them is working.

- The moving wave is drawn from the microphone Aura holds open herself. That part is fine, which is why you see it vibrate.
- The words are supposed to come from the browser's own built-in speech listener. On phones and on Chrome, that built-in listener refuses to share a microphone that the page is already holding: it starts, reports no error, and hands back silence. So the wave moves and nothing is ever written.

This is also the same root cause behind the two older complaints — the microphone "being lost" every few seconds, and only the first few words surviving. The browser's built-in listener is the unreliable piece.

Lovable's own recording works differently: it records the sound and sends it to be transcribed. MathGPL already has that exact ability (`speech-transcribe`), it is already streaming, and it costs nothing extra.

## The fix

Stop depending on the browser's built-in listener. Aura records from the one microphone she already holds and gets the words back from the platform's own transcription — the same way Lovable does it.

1. **One microphone, one recorder.** The held microphone feeds both the wave and a recorder. Nothing competes for the device, so nothing goes silent and nothing re-asks for permission.
2. **Words come back in short slices.** While you speak, small slices of sound are sent for transcription and the words appear as they return, so the five-line panel fills up live.
3. **Nothing is ever replaced.** Each returned slice is added to the end of what you already said. The whole turn survives — "I went to school this morning, I ate breakfast, and I actually took a cab" arrives complete.
4. **A turn ends by loudness, as planned.** The existing loudness-based turn detection stays exactly as it is and now drives the recorder: quiet for the adaptive pause plus the last slice returned closes the turn and Aura answers.
5. **The browser listener becomes a backstop only.** On a desktop browser where it genuinely works and transcription is unavailable, it is still used. It is never used during a call.
6. **The wake word keeps working.** It listens on the same returned words, so calling her by name still wakes her.
7. **Honest status.** If transcription fails, the panel says so plainly instead of vibrating in silence.

## What does not change

Her voice, the speed work already done (she speaks on her first few words), the input bar, the plus attachment button, spoken replies, the five-line editable panel, her platform abilities, lesson notes, Smartboard, Floating Numbers and the Game. No new voice vendor, no per-minute bills.

## Technical notes

- New `src/components/agent/recognizeStream.ts`: `MediaRecorder` on the held stream (`audio/webm;codecs=opus`, 250 ms timeslices), rolling ~1.2 s segments posted to the existing `speech-transcribe` function, SSE deltas parsed into text. Reuses `src/lib/editor/transcribe.ts` parsing where it fits.
- `useListening.ts` gains a transcription engine alongside the recognition engine, chosen by a `prefer` flag (`"transcribe"` by default on the call path and on mobile). Its public surface is unchanged (`mode`, `level`, `transcript`, `finalPending`, `editTranscript`, `clearTranscript`, `start`, `stop`, `error`) so `AuraProvider` and `CallTranscript` need no rework. Accumulator stays append-only; `finalPending()` returns true while a posted slice is still outstanding so the turn gate cannot close mid-sentence.
- `voiceSession.ts` untouched apart from being fed by the new source; `paused` still discards anything heard while Aura speaks.
- Errors: a failing transcription call maps to a plain `ListeningError` and surfaces through the existing `errorMessage`; no retry loop.
- Tests: segment accumulation across slices, append-never-replace, `finalPending` while a slice is outstanding, wake-word extraction on transcribed text, fallback selection when transcription is unavailable.
- Verification: a real two-minute call on your phone — long sentence, pause mid-sentence, talk over her — reporting whether words appear and the measured delays on the call strip.
