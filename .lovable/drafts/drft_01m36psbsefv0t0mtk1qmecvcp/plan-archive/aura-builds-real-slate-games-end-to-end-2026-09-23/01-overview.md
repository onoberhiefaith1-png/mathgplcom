# Aura builds real Slate Games, end to end

Goal: a teacher says "Create an Indices game for SS1 with original artwork, a short
video and suitable rewards", and Aura prepares the questions, builds a saved draft,
generates the media (asking before each charge), configures rewards, tests what can
be tested, shows the result, and only publishes or assigns after you say yes.

This first delivery covers **Slate Games**. Adventures come next, on the same spine.

## What I confirmed in your app first

- The real 3D game lives in `slate_games`, its questions are references into lesson-note
  Floating Numbers (`slate_game_questions`), and class assignment goes through
  `slate_game_assignments`. All of this already works from the editor.
- Aura's current two game abilities point at a **different, older games table**, so today
  she genuinely cannot see or touch a real Slate Game. That is the first thing to fix.
- Aura already authors lesson notes properly: note, session, question, solution,
  highlight, generate Floating Numbers, Smartboard dry run, assign — reusing the same
  code the screens use. That stays exactly as it is.
- Picture generation already exists for game covers (real, server-side). Video generation
  does not exist yet anywhere in the app.
- Correctness marking is already decided on the server and the answer is never sent to
  the browser. Reward behaviour is worked out in the game itself from those marks.
- There is no shared media library table today, and no branching in Adventures.

Anything the app does not have, Aura will say it does not have. She will never report a
video as made while it is still being made.

## Your decisions, folded in

- Slate Games first; Adventures follow.
- Real narrated, captioned video — not just a script.
- Aura shows the cost and waits for your yes before every picture or video.
- Testing happens in a clearly labelled hidden test class in your own workspace, with
  test learners. No real student is ever used as test material.
