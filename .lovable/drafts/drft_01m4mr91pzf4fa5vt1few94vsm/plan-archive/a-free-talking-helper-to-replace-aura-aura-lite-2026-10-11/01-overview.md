# A free, talking helper to replace Aura ("Aura Lite")

## The honest answer
Yes. Most of what Aura does is not thinking. It is operating the app: "open my classes", "create a class called JSS2", "link this game to my class", "add a session", "read my note". Those are fixed actions with names. We don't need an expensive AI to choose them. We can do it the way the evaluation engine works: with rules that run on the device, no AI, and work offline.

Aura was expensive for three reasons. Each one gets a free replacement:

| Aura cost | Replacement | Cost |
| --- | --- | --- |
| Paid AI voice (speech generation every reply) | The phone's or laptop's built-in voice | Free, works offline |
| Paid listening / an AI working out what you meant | The browser's built-in speech-to-text plus a set of command rules on the device | Free |
| An AI "brain" choosing and running actions | A command matcher that picks one of Aura's existing actions | Free |
| Writing maths and lesson notes | Stays with the Copilot generator, as now | Same as today |

## The cost rule
Aura Lite never costs more than generating a lesson note, and usually costs nothing:
- About 90% of requests (opening pages, creating classes, linking, listing, reading out a note) use no AI at all.
- When it can't understand a sentence, it first asks "Did you mean…?" with buttons. Still free.
- Only if you allow it, one tiny cheap AI call (the smallest model, about 0.0003 credits, roughly 3,000 times cheaper than a lesson note) turns the sentence into a command. Hard daily cap per teacher.
- "Make a lesson note on…" hands over to the Copilot, which you already pay for, so the cost is the same as pressing the button yourself.

## What teachers will see
- One round microphone/chat button, bottom-right, for teachers only. Students don't see it.
- Talk or type: "Open my JSS2 class", "Create a game from my last question", "Go to Academia".
- It replies by speaking with the device voice and shows a short line and a step card ("Opened Classes → JSS2").
- Anything that changes or deletes data shows a Confirm button first.
- Offline: navigation, reading notes out loud and help answers work without data. Actions that save to your account wait and send when the connection is back.

## What stays the same
Aura remains archived and admin-only, untouched. Copilot, the evaluation engine, Smartboard and Game are not changed.