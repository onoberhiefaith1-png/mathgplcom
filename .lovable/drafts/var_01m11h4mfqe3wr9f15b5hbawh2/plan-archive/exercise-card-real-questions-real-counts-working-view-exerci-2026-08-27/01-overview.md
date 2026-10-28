# Exercise Card: real questions, real counts, working View Exercise

Only the Exercise card and its linked questions change. No Adventure work, no new relationship, no placeholder values.

## What I found (verified against your data)

Your card **Practice Set A** has exactly one linked question row (label "ADD", 12 marks) — that is where the "1 question · 12 marks" line comes from, so the link itself is saved and correct.

But when **View Exercise** opens, it rebuilds the question from the lesson note the link points at, and that lesson note no longer exists in the database (the note, its section and its question row are all gone — deleted or replaced at some point). The rebuild finds nothing, so the page says there is no question. A second card in your account ("Quadratic formula", 51 marks) points at a note that *does* still exist, and that one will open normally.

So there are two separate faults to fix:

1. **A broken link is reported as "no exercise"** — the page must instead show the question list it actually has, and say plainly which entry lost its source note and offer to relink or remove it.
2. **A link should survive a note being re-saved.** Links currently store only the raw row id. They will also resolve by the note's durable keys, so a question that was re-created keeps working instead of silently dying.

## What changes on the card

- **Number of questions** and **Total marks** become live, calculated values from the linked questions — the typed number fields go away (the `1` and `77` you see now are typed defaults, not data). Pass mark % stays editable, since that is a teacher decision.
- **View Exercise** stays where it is, and always opens, even with zero questions (it then explains how to link one).

## The exercise view

Opening it gives a proper page: the card name as the heading, the live "N questions · M marks · pass X%" line, then a numbered list — Question 1, Question 2, Question 3 — each with its own marks and a video badge where a teaching video exists. Every row is independently selectable and opens the Smartboard on that exact question, unchanged, with **Add Video** available. A row whose source note is missing is shown greyed with "Source question not found — relink or remove", never hidden and never counted as solvable.
