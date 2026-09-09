# Smartboard — line colour meaning, timer on guest links, full screen, dust pen, chip tags

Targeted corrections only. The question content, marking engine, floating-number engine, notes, navigation and reset mechanism stay as they are.

## 1. A line with no floating number has no mark state

Right now the top number strip gives every guided line a slot, so a line that only carries a note can pick up a colour. Change it so a position is only ever coloured when that line actually carries floating-number work (its own line id plus filler/table content, and not a note-only line).

- No floating number → neutral, exactly as the first line in the screenshot looks today. No blue, no brown, no change to the note.
- Floating-number line whose mark is already awarded → blue, permanent, untouched by Reset.
- Floating-number line approved during the live timed attempt → brown.

Only one visible number row, only three positions (previous · current · next), only two colours. Green never appears.

## 2. Reset

Reset clears only the current attempt layer, so brown falls back to the blue that is already earned, blue stays blue, neutral stays neutral. This is the intended behaviour of the existing attempt layer; the plan verifies it end to end (brown → Reset → blue → solve again → brown) rather than reworking scoring.

## 3. Timer must survive a guest link

Confirmed cause: the guest link never carries the timer setting. The public guest endpoint returns only `id, title, questions, total_marks` for each card, the guest board never passes a timer flag into the board, and the attempt layer only runs for a signed-in student.

Fix in three parts:

- Include the card's timer setting in the guest payload and its type.
- Pass it into the board from the guest board component.
- Give the attempt layer a guest mode: same start/pause/resume/complete rules, attempt state kept on the guest's own device, completion time sent through the existing guest endpoint that already records guest times, and Best Time / Overall Best read through the existing best-times reader (it already counts guest times).

Timer rules unchanged and re-verified: stopped on open, starts at the first solving input, pauses on leaving the page, resumes immediately on return, stops at 100%, keeps the fastest completed time, Reset never erases Best Time. Overall Best stays hidden until Best Time is tapped.

When the teacher did not enable a timer: no timer, no brown, no Best Time — awarded floating-number lines are blue, note-only lines neutral.

## 4. Full screen on a phone

Ask for full screen on the page root rather than the board element (iOS Safari refuses element full screen), keep the existing immersive fallback for browsers that refuse outright, and make the board fill the whole viewport in that state — the guest session header and any outer padding give up their space. Where the browser will not hide its own address bar, the board still takes every pixel the browser allows.

## 5. Dust pen activation

Wire the phone eraser button so pressing it truly enters erase input mode, shows an unmistakable active state while selected, and returns to normal on a second press. No other drawing tool changes.

## 6. The # control

Give it the same clear active state and immediate open/close of the floating-number strip.

## 7. Internal L tags on each floating number

The per-chip L tag stays in place in the data and the DOM with its identifier intact; only its visual rendering blends away so the student sees just the number. The top `◀ L1 ▶` navigation is untouched.

## Technical notes

- `src/components/smartboard/PresentationView.tsx` — restrict the coloured strip to scored guided lines, keep blue/brown only, active states for eraser and `#`, full-screen target.
- `src/components/smartboard/FloatingNumberPanel.tsx` — blend the per-chip line tag.
- `src/hooks/useQuestionTimerAttempt.ts` — guest-mode attempt (local persistence + guest completion post).
- `src/routes/api/public/guest/$slug.ts`, `src/lib/guests/guestApi.ts`, `src/components/guests/GuestBoard.tsx` — carry the timer setting to the guest board.
- Tests: extend the touch-UI tests for the neutral/blue/brown rule; run typecheck plus the Smartboard suites, then check the guest link live on a phone-sized viewport.
