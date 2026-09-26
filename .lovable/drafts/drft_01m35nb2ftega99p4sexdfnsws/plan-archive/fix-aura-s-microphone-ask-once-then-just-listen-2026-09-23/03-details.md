## How it behaves

**Arriving for the first time** — Aura shows her short request: why she needs the microphone, that nothing is stored, and one "Allow Microphone" button. Clicking it triggers the browser's own prompt. Allow → the status light turns green, she is listening, and she says so in the panel.

**Coming back later** — already allowed, so nothing is asked; she is listening from the moment her panel opens (if her ear is switched on).

**The microphone button at the bottom** — not allowed yet: asks. Allowed: starts recording with the live wave. Recording: stops.

**When it can't work** — blocked shows the browser unblock steps; a microphone held by another app says to close it and try again; a preview window that isn't permitted to pass the microphone through says that plainly; only a genuinely empty device list says "no microphone detected".

## Technical notes

- Rewrite `src/components/agent/micPermission.ts` into a single entry point `requestMicrophoneAccess()` that returns `{ state, stream }` and **keeps** the `MediaStream` (today it calls `stream.getTracks().forEach(stop)` right after acquiring it, and `useListening.startMeter` then calls `getUserMedia` a second time — the second call is where the failure arises).
- Replace the current error mapping (`NotFoundError → no-microphone`, everything else → `denied`) with explicit `DOMException.name` handling: `NotAllowedError`/`SecurityError` → `blocked`; `NotReadableError`/`TrackStartError` → `in-use`; `OverconstrainedError`/`AbortError`/unknown → `failed`; `NotFoundError`/`DevicesNotFoundError` → re-check `enumerateDevices()` for any `audioinput` and only report `no-microphone` when none exists, otherwise `failed`.
- Add environment preconditions reported as their own states, checked before blame is assigned to the device: `window.isSecureContext`, and framed-without-delegation detection via `window.self !== window.top` plus `navigator.permissions.query({name:"microphone"})`/`document.featurePolicy?.allowsFeature("microphone")`. Production is already `https://mathgpl.com`, so this only surfaces preview/embedded cases and needs no hosting change.
- `useListening` gains an injected-stream path: `start(mode, stream?)` uses the provided stream for the `AnalyserNode` and only starts `SpeechRecognition` after the stream exists. Its internal `getUserMedia` fallback stays for the already-granted case but routes through the same central manager so error wording is shared.
- `AuraProvider`: hold the granted stream in a ref; `requestMic()` resolves → immediately `listening.start(wakeEnabled ? "wake" : "capture", stream)` so allowing is the last action required. Expose a derived `micStatus` (`off | requesting | listening | blocked | in-use | unavailable | insecure | framed`) for the indicator. Release the stream on unmount/sign-out.
- `AuraCockpit` header: small status dot + label driven by `micStatus`. `AuraMicPermission` dialog copy keyed off the same status so each of the four states has its own title, body and action ("Allow Microphone" / "Enable Microphone" with unblock steps / "Try again" / informational only).
- Extend `src/components/agent/__tests__/micPermission.test.ts` and `listening.test.ts`: every `DOMException` name maps to the intended state, `no-microphone` requires an empty audio-input list, insecure/framed contexts never report a missing device, and a granted stream is reused rather than re-requested.
- Verify with `bunx tsgo --noEmit`, `bunx vitest run src/lib/agent src/components/agent`, and a signed-in Playwright pass using `--use-fake-device-for-media-stream` plus a run with the fake device removed to confirm the failure wording differs correctly.
