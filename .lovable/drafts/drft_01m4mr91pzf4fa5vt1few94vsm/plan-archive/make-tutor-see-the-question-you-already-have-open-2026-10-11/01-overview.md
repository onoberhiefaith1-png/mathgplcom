# Make Tutor see the question you already have open

## What went wrong in your screenshot

You were on an Academia Practice question ("Solve for p. 2p − 3 = 9") and asked for a full tutorial guide. Tutor said "Open the question you want first", and when you replied "I have opened it", it said the same thing again.

The cause is confirmed in the code:

- The step-by-step Guide is only built into the **offline** Academia app. The normal online Practice board (and assignments, Smartboard, Game) never tells Tutor "a question is open here, and these are its solution lines".
- So Tutor thinks no question is open, no matter what you say.
- Tutor also doesn't remember what you asked last. "I have opened it" is treated as a brand-new request instead of "try the last thing again".

Nothing is wrong with your wording. Tutor is missing the information.

## What will change

1. **Every question screen tells Tutor what's open.** This includes online Practice, assignment boards, the Smartboard and Game questions. The board you are already looking at reports its question and its stored solution lines.
2. **"Guide me" works where you are.** The Guide opens beside the board, using the stored solution of that exact question. It speaks one line at a time and never makes up any maths. No AI credits are used.
3. **Tutor knows what's on your screen.** On each turn, Tutor gets a short list of what this page can do right now (for example "question open: Solve for p", "Floating Numbers available", "Guide available"). It stops asking you to open things that are already open.
4. **Follow-ups continue the last request.** If something really is missing and Tutor asks you for it, it keeps your request waiting. When you reply "done", "I have opened it", or open the screen yourself, it carries on without you asking again.
5. **Honest replies when something truly isn't possible.** If a page has no stored solution, Tutor says exactly that ("this question has no saved solution yet") instead of a generic "open the question first".

Assignments, scoring and Floating Numbers on the board stay exactly as they are. The Guide is an extra panel that sits beside the board.
