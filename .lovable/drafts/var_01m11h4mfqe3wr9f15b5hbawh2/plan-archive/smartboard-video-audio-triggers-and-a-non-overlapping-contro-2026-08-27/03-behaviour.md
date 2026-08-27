## Playback rules

| Situation | What happens |
| --- | --- |
| Board opens, Introduction exists | Introduction becomes active and plays |
| Board opens, no Introduction | Nothing plays; the board waits for a line |
| Floating number activates a line with **no mark yet** | That line's segment plays |
| Floating number returns to a line that **already earned its mark** | Segment becomes active but does **not** auto-play |
| Student activates a line while Introduction is playing | Introduction stops, the line segment takes over immediately |
| Last line marked correctly | Conclusion plays, if one exists |
| No Conclusion | Nothing extra; no empty player, no error |
| Previous / Next pressed | Manual move only, always available, never blocked by marks |
| View switched (Smartboard / Split / Video) | Same active segment, same playhead, same volume and mute state |
| Video file missing or fails | A quiet in-player message; the Smartboard keeps working |

Only one instructional audio source is ever unpaused: activating any segment
pauses whatever was speaking before it.

## Audio

A compact speaker button in the player's control bar opens a slider on hover or
click: mute/unmute by pressing the icon, real-time volume by dragging. The icon
shows the state (muted, low, full). Volume and mute are held once for the whole
session, so they carry across the three views.

Because browsers block sound-on autoplay until the student interacts, the
Introduction starts muted-with-a-visible "Tap for sound" affordance **only if**
the browser refuses the sound-on start; the moment the student touches the board
or the player, sound is enabled and stays enabled for the rest of the lesson.

## Student vs teacher

The student board keeps only Back / Practice / Discuss, the three view buttons,
the board and the player. No evaluation, expected-line or configuration
controls appear there. The teacher board keeps everything it has today; it only
gains the same stacked control rows and the same audio controls.

Teacher Test Mode already starts each visit with an empty mark set, so leaving
and re-entering a test lets every line's video play again; student marks are
untouched by testing. This plan keeps that separation and adds nothing that
would persist test marks.
