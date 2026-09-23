## How it behaves

**Recorder button (bottom of the panel)**
Tap it: permission is requested if needed, the wave starts moving with your voice, and your words appear in the box as you speak. Tap again (or send) to stop. If Aura is already listening for her name, that pauses for the moment and resumes after.

**Saying "Aura"**
With the ear on, she listens in the background with no wave (nothing is being recorded for you yet). The instant her name is caught, the wave appears, a soft chime plays, and she captures the sentence you continue with. Name alone opens the panel and keeps the wave running for a few seconds, waiting for you.

**When it can't work**
Blocked microphone, unsupported browser, or a listener that dies gets a short plain message in the panel with a button to try again — never silence.

## Technical notes

- Replace the two competing hooks with one shared listening engine (`useListening`) owning a single `SpeechRecognition` instance plus one `getUserMedia` stream and an `AnalyserNode`. It exposes `mode` (`off` | `wake` | `capture`), `level` (0–1 from RMS), `transcript` (interim + final), `error`, `start(mode)`, `stop()`. Mode switches restart the same instance rather than creating a second one.
- The engine is created once inside `AuraProvider` and exposed on `useAura()`, so the cockpit's recorder button, the wake-word badge, and the composer all read one source of truth. `useDictation.ts` and `useWakeWord.ts` are retired; `extractWakeCommand` moves into the engine and keeps its existing tests.
- Waveform component (`AuraWaveform`) renders bars from `level` on a `requestAnimationFrame` loop, mounted both in the cockpit composer and in the floating wake badge. Analyser node only, no recording buffer kept.
- Permission and error surfacing: distinguish `not-allowed`, `no-speech`, `audio-capture`, and `service-not-allowed` from `SpeechRecognition.onerror` (which currently takes no event argument) and map each to a short message plus a retry action.
- While `speaking` is true or a turn is in flight, the engine drops recognition results instead of stopping the stream, so the wave stays visible but she cannot hear herself.
- Auto-restart keeps a backoff and a consecutive-failure ceiling so a blocked microphone cannot loop.
- Verify with `bunx tsgo --noEmit`, the existing agent tests plus new engine tests (mode transitions, self-hearing suppression, error mapping), and a signed-in Playwright pass with a fake audio device (`--use-fake-device-for-media-stream`) to confirm the wave renders and the wake phrase reaches `send`.
