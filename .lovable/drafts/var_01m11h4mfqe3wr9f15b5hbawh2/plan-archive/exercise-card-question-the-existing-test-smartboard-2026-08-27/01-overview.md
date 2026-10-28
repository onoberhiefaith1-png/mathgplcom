# Exercise Card question → the existing Test Smartboard

Selecting a question on an Exercise Card currently lands on a screen stuck at "Loading notebook…". The cause is confirmed in code: the board is mounted without a test container, so it leaves test mode and tries to open a lesson notebook that isn't there.

The fix is not a new board. The question opens the *same* Test Smartboard already used by Floating Numbers → Test — with its Evaluation panel, floating numbers, line grading, marks and Restart — with the selected question already on it.

## What changes for the teacher

- Exercise Card → tap a question → the Test Smartboard opens with that question written at the top, ready to solve.
- Live Evaluation panel on the right (Expected line, student line, AI evaluation, floating numbers for the line) exactly as it behaves today.
- Bottom bar: Back, Viewing: Test, Evaluation toggle, marks total, Restart, Exit test — identical to the existing test board.
- Nothing is recorded against a student; every entry is a fresh disposable sitting.
- No waiting on video: the board opens immediately. The Add Video button stays where it is; the video and three-screen work is untouched and comes later.
