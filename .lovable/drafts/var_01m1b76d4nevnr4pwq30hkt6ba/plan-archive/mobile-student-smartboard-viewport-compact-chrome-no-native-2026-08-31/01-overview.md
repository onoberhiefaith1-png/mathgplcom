# Mobile Student Smartboard — Viewport, Compact Chrome, No Native Keyboard

Phones and tablets become a **camera onto the existing board**, not a shrunken copy of it. Nothing about the desktop/teacher Smartboard, the maths engine, marking, sync, zoom, questions or submission changes. Every change below is gated on *phone/tablet width* **and** *student/guest role*.

## What the student gets on a phone

**1. The board stays big; the window moves.**
The writing surface keeps a comfortable minimum board width instead of being squeezed to the phone width. The board area becomes horizontally pannable, so the student sees a readable portion and moves across Introduction → Working → Answer. Existing zoom keeps working on top of this: zoom out to see more, zoom in to read, pan to move.

**2. Interaction model that protects writing.**
- One finger — write, drag floating numbers, tap objects, select lines (unchanged).
- Two fingers — pan the board horizontally (and vertically) without writing.
- Pinch — existing zoom.
- Small, unobtrusive ‹ › edge arrows step the viewport one screen left/right with a smooth scroll.

**3. The native keyboard never opens.**
The board's hidden capture textarea is the cause: it is auto-focused whenever the sensor moves. In mobile student mode it becomes a non-typing capture (`inputMode="none"`, no auto-focus) so touching the canvas never raises the phone keyboard, and the keyboard can never cover the board. Hardware keyboards on tablets still work; text fields elsewhere in the app are untouched.

**4. Compact, collapsible session header.**
The dark session bar (Back to course · title · marks · guest chip · Board/Split/Video switcher) collapses to one slim row on phones: `← Back · title · 0/98`. Split-view and Video switching stay available in that compact row, and the header hides completely in full-screen mode.

**5. Full screen = maximum board.**
Full screen hides the whole session header; the question strip slides up into the freed space and the board grows. A small floating restore icon stays in the corner. Because iOS Safari does not grant real element fullscreen, this is an in-app immersive mode (the existing global fullscreen button still uses the browser API where supported).
