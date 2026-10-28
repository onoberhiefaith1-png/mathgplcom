# Assigned questions become permanent, independent copies

Goal: the moment a question is handed out — Assignment, Adventure, Course/Exercise Card, Assessment or Smart Card — the platform keeps its own frozen copy of that question and everything needed to solve it (question text, every floating number, its containers, per-line marks, notes, table workspaces, and the hidden answer key). From then on the student version never looks at the Lesson Note again, so editing, moving, renaming or deleting the note cannot change or break work already given out.

## What is already safe, and what is not

Checked against the current code:

- Assignment, Assessment, Smart Card, Game/Adventure bars: already store a frozen copy when they are created or published (the question set and the answer key are written once, and the student board reads that copy). These stay as they are, with one guard added: once a copy exists it is never recompiled from the note again.
- Course / Exercise Cards: **not safe today.** An Exercise Card only stores a pointer back to the Lesson Note (note, section, question, label, marks). Every time a student or teacher opens the card, the question is rebuilt live from the note. If the teacher edits the note the card silently changes; if the note is deleted the question shows as missing and the card total collapses.
- The guest/shared-link route for exercise questions rebuilds from the note in the same way.

So the work is: give Exercise Card questions the same frozen-copy treatment the other four already have, behind one shared storage place, and make every reader prefer the copy.
