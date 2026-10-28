# Smartboard — no native keyboard on phone and tablet

On a phone or tablet the device keyboard slides up and eats half the Smartboard, so the mathematical workspace becomes unusable. The fix is a single device-and-surface rule: inside the Smartboard (and the Assessment Smartboard), on phone or tablet, the native keyboard never opens. Everything else in the app is untouched.

Today the board already suppresses the keyboard, but only for one narrow case: a **student** on a small screen (`useMobileStudentBoard`). A teacher, guest or presenter on a tablet still gets the native keyboard. This change widens the rule to "any touch device inside the board", and applies it to every place on the board that can currently raise a keyboard.

What stays exactly as it is:
- Desktop and laptop Smartboard: full physical keyboard support, unchanged.
- Login, names, search, lesson-note text, every other form and input on any device.
- All existing Smartboard writing, symbol, number and navigation controls — nothing is removed.
