# Make Aura hear you correctly

You are right that the fault is in her hearing, not her voice. But it is not the
transcription service that is wrong — it is how her audio is cut up before it
gets there.

## What is actually happening

Right now Aura records your voice in blind **1.5-second pieces**. A timer stops
the recorder every 1.5 seconds regardless of whether you are mid-word, and each
piece is sent off **on its own**, with no knowledge of the piece before it or
after it.

So when you say "the text-to-speech is really bad", the listener receives
something like `the text-to-sp` / `eech is real` / `ly bad, okay so right`. A
transcriber handed a fragment that begins and ends mid-word has to guess — and
"text-to-speech" becomes "gas suspension". Lovable heard you correctly on the
same microphone because it sends one continuous recording of your whole
sentence, not fragments.

That also explains the stray words ("Site, all of it") — those are guesses at
half-syllables at the edges of each cut.

## The fix

1. **Cut on silence, not on a stopwatch.** Aura already measures how loud you
   are (the wave moves with your voice). Use that same loudness to decide where
   to cut: keep recording while you are speaking, close the piece only after a
   real pause, and force a cut only if you have been talking for a long stretch
   — and then at the quietest moment available, never mid-word.

2. **Give each piece a small overlap and its context.** Each recording carries
   a short run-up so no syllable falls between two pieces, and the words already
   heard in this turn are passed along as context so the transcriber knows the
   conversation is about equations, Smartboard, Floating Numbers, lesson notes —
   not car parts.

3. **Tell the transcriber the language and vocabulary.** The language setting
   is currently sent by the app but thrown away before it reaches the
   transcription service. Pass it through, along with a short MathGPL vocabulary
   hint (the terms above, plus quadratic, factorise, session, assignment).

4. **Never hide a failure.** If transcription errors, Aura says so plainly
   instead of continuing with an empty or invented transcript, and the failure
   shows in diagnostics.

5. **Voice diagnostics panel**, behind a small toggle any teacher can open:
   microphone connected, permission state, listening on/off, current loudness,
   live piece vs final transcript, round-trip time per piece, speaking status,
   and the last error.

6. **Proof before I call it fixed.** I will speak your test sentence through the
   pipeline several times and show you the transcript each time. If the words
   still come back wrong after the cutting is fixed, the next step is moving to
   the higher-accuracy listening model — but I will show you the evidence
   first rather than spending on it blindly.

## Untouched

Aura's brain, her voice and how she speaks, interruption and barge-in, the
input bar and plus button, the meaning-repair pass, lesson notes, Floating
Numbers, Smartboard, Game behaviour, saved teacher designs, and cost per turn.

## Technical notes

- `src/components/agent/recognizeStream.ts`: replace the fixed `SEGMENT_MS = 1500`
  timer in `TranscriptionListener.cycle()` with voice-activity segmentation —
  the listener takes a level source, closes a segment after ~700ms below the
  speaking threshold, with a 12s hard ceiling and a 400ms tail overlap carried
  into the next segment. `transcribeSegment` gains an optional `context` string
  sent as `prompt`.
- `src/components/agent/useListening.ts`: expose the existing analyser's
  smoothed level to the listener instead of keeping it only for the wave, and
  feed the accumulated turn text back as segment context.
- `supabase/functions/speech-transcribe/index.ts`: forward `language` and
  `prompt` from the incoming form to the gateway `/v1/audio/transcriptions`
  request (both are currently dropped); keep the model as
  `openai/gpt-4o-mini-transcribe` for now, keep SSE passthrough, return real
  error bodies.
- New `src/components/agent/VoiceDiagnostics.tsx` rendered inside
  `AuraCockpit` behind a toggle, reading state already held by `useListening`
  plus new per-segment timing marks.
- Unit tests for the segmentation decision (a pure `shouldCloseSegment`
  helper) and for label/error handling, so the cut logic is testable without a
  microphone.
