# Fix the Class → Adventure relationship

## What I confirmed on the live database

I queried the live database directly. The two tables the Adventure screens rely on do not exist yet:

- `public.class_adventures` — missing
- `public.adventure_bar_questions` — missing

That is the exact cause of "Could not link Adventure". Nothing is wrong with the Adventure card, the picker, or the questions. The link has nowhere to be stored, so the database rejects the write and the screen reports it honestly.

The reason they are missing: this work is happening in a **draft**. A draft shares the live database and is not allowed to change its structure. The structure change is written and waiting; it is applied to the real project the moment you **accept this draft**. Until then the error will keep appearing in the preview, and I will not fake a working preview with a stand-in.

## What is already built (and matches your specification)

I read through the Adventure screens and the assignment flow. The architecture you described is already in the code:

- A class links **many** adventures; each becomes its own Adventure Card with its own progress bars.
- The same adventure links to several classes; each class keeps its own questions.
- Linking twice is prevented; unlinking removes only that class's use of the adventure.
- Questions are assigned afterwards through **Question → Class → linked Adventure → Progress Bar**, with per-bar marks and pass percentage.
- Empty state reads "No Adventure linked to this class yet." with a Link Adventure action.
- The Adventure editor, videos, timelines, timers, rewards and student playback are untouched.

So this plan is not a rebuild. It is: apply the structure, confirm it live, and re-verify the whole flow end to end.
