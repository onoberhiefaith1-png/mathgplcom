# Smartboard: no phone keyboard + live Subcell typing

Only two fixes. Table, Subcell, Advance, Floating Numbers, blue glow and Calculate stay exactly as they are.

## 1. Phone/tablet keyboard never opens on the Smartboard
- Tapping a normal cell or a Subcell on a touch phone/tablet keeps the board fully visible; the device keyboard does not appear.
- Input continues through the Smartboard's own Floating Numbers and keys.
- Desktop and laptop keep normal physical-keyboard typing.
- Applies only on the Smartboard; lesson notes and other forms are untouched.

## 2. Subcell working shows live
- Every number or symbol entered into the active Subcell (Floating Numbers, board keys or keyboard) appears inside the Subcell immediately: `8`, then `8 − 4`, then `8 − 4 − 3`.
- Nothing waits for tapping another cell or leaving the Subcell.
- The blue active glow stays while the working is shown.
- Calculate is unchanged: the working stays above the line and `1` appears below it; tapping another cell still shows both.

## Checks
- Automated test: a value change sent to an active Subcell editor from outside (a Floating Number tap) is shown straight away.
- Phone-size browser check on a Smartboard table: tap a Subcell, enter `8 − 4 − 3`, confirm it shows at each step, Calculate gives `1`, tap another cell and both stay. The real device keyboard can't be seen in a test browser, so that part is confirmed by checking the keyboard is switched off on touch devices.

## Technical details
- Cause of the live bug: `MathCellEditor` copies `value` into its own state once and ignores later changes, so Floating Number writes to `entries["sub:k"]` only show after the editor unmounts. Fix: keep the last value it emitted; when `value` changes from outside, rebuild the tree from it (caret to end).
- Keyboard: add an optional `suppressNativeKeyboard` prop to `MathInlineCanvas` (hidden input gets `inputMode="none"` and `readOnly` when on), passed via `MathCellEditor` from `TableActivityStage` using `useBoardNativeKeyboard()`. Default off, so other editors are unchanged.
- No changes to Calculate, `FloatingNumbersPage.tsx`, or Row/Column handling.
