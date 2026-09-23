# Permanent Microphone Access and Mobile Recovery

## Goal
After the browser grants microphone access once, MathGPL will remember that consent and will not show its permission request again. Temporary mobile interruptions—silence timeouts, screen changes, travel/network changes, locking the phone, switching apps, or the browser restarting speech recognition—will recover automatically without being presented as lost permission.

The browser remains the final authority: MathGPL cannot override a permission the user manually removes, a browser privacy reset, private browsing, or an operating-system restriction. In those cases only, the app will explain how to restore access.

## Confirmed cause
- Aura uses one microphone stream for listening and the animated voice meter, but several normal stop/restart paths stop that shared stream itself.
- The speech recognizer commonly ends on mobile even though permission remains granted. These normal endings are currently counted as consecutive microphone failures; after four endings Aura switches off and shows “I lost the microphone.”
- Recovery can call the permission-request function again when the stored stream is no longer live, conflating “reopen an already-authorized microphone” with “ask the user for permission.”

## Changes

### 1. Separate consent from a live microphone session
- Keep a durable local record that the user completed the first permission decision.
- Always check the browser’s current permission before showing MathGPL’s permission explanation.
- Never reopen MathGPL’s permission dialog merely because recognition or a media track ended.
- Signing out and back in will not clear the consent record.

### 2. Add one shared microphone owner
- Introduce a single microphone-session controller used by wake listening, recorder mode, live voice, and the waveform meter.
- Reuse a healthy stream and prevent simultaneous requests.
- Detaching the waveform meter will close only its audio analyser, not the shared microphone track.
- Explicitly ending voice or disabling wake listening will stop listening cleanly without changing the saved permission state.

### 3. Recover mobile interruptions without prompting
- Treat the recognizer’s routine `onend`, `no-speech`, and deliberate restart events as lifecycle events, not permission failures.
- Restart with bounded backoff while live voice or wake listening is still enabled.
- When a track actually ends, re-check browser permission first. If still granted, silently reacquire the microphone and resume the active mode.
- Pause safely while the page is backgrounded and resume when it becomes visible again, avoiding duplicate listeners and five-second failure loops.

### 4. Show the permission panel only for real permission states
- First use: show the existing explanation, then the browser’s permission prompt.
- Already granted: start or resume directly.
- Manually revoked or browser/OS blocked: show one clear restore-access message.
- Device temporarily unavailable or another app is using it: keep consent intact and offer a retry without claiming permission was lost.

### 5. Preserve Aura behaviour
- Keep the existing blue live-conversation button, wake word, recorder, waveform, interruption handling, text conversation, attachments, and explicit End control.
- Do not change Aura’s AI model, voice model, tools, lesson workflows, or saved conversations.

## Verification
- Add tests for permission-state restoration, shared-stream reuse, analyser cleanup without track shutdown, normal recognition restarts, true revocation, temporary device loss, background/foreground recovery, and duplicate-request prevention.
- Test the live panel in a mobile viewport through repeated silence cycles, voice interruption, panel close/reopen, page navigation, background/foreground simulation, and logout/login.
- Confirm the app never displays its permission request again after browser-granted access unless permission is genuinely revoked or reset outside MathGPL.
