# Smartboard touch fixes: full screen, three question numbers, permanent controls

Three specific faults remain on phone/tablet. Laptop/desktop layout stays exactly as it is.

## 1. Full screen actually activates

Today the full-screen button on a guest board only flips an internal "immersive" flag, so the browser never goes full screen.

Fix:
- The button asks the browser for real full screen on the board surface, and exits it on the second tap.
- The immersive (chrome-hidden) mode still switches on together with it, so browsers that refuse full screen still give the whole screen to the board.
- The icon follows the real state (it listens for full-screen changes), so it can never show the wrong state.

## 2. Three question positions instead of one

The touch header currently counts the wrong thing: on signed-in assessment boards it counts sections of the current question, which is often just one, so a single number shows.

Fix:
- The header always uses the real question list of the assignment/exercise/guest link.
- It always renders three positions: previous, current, next. The current question sits in the middle whenever possible; at the first or last question the window shifts so three positions still show (empty positions render as disabled placeholders when there are fewer than three questions).
- Tapping a position moves to that question exactly as it does now.

## 3. The six controls stay visible at all times

The strip is anchored inside the scrolling board content, so when the Floating Numbers panel closes it loses its measured anchor and drifts out of view.

Fix:
- The strip is anchored to the screen (same anchoring the Floating Numbers panel already uses), never to the scrolling lesson content, and is no longer tied to whether that panel is open or which lesson section is showing.
- Closed panel: the strip rests just above the bottom edge, respecting the phone's safe area.
- Open panel: the strip rises to sit directly above the measured panel height.
- Only the Floating Numbers panel toggles; the six controls (eraser, floating numbers, undo, redo, previous, next) are permanent.

## Technical notes

- All work is in `src/components/smartboard/PresentationView.tsx`, with a small pass-through change in `src/components/guests/GuestBoard.tsx` if the full-screen state needs to be shared.
- Full screen: `requestFullscreen`/`exitFullscreen` on the smartboard root element plus a `fullscreenchange` listener; `touchSession.onFullscreenChange` continues to drive the immersive fallback.
- Question window: derive count/index from the assessment source's question list (guest already supplies `questionCount`/`questionIndex` via `touchSession`); replace `beats.length` fallback in `questionWindow`, and pad the window to three slots.
- Controls strip: render through the existing smartboard root portal with `position: fixed`, drop the `carrierVisible`-adjacent placement assumptions, and keep using the `floatingBox` measurement only as an upward offset with a safe-area default.
- No change to grading, sync, the solving engine, or the desktop branches.

## Verification

- Phone and tablet: full screen enters/exits, three question positions render and move, six controls stay visible with the panel open and closed.
- Guest link, student assessment board, and desktop board unchanged otherwise; typecheck and Smartboard tests run.
