# Co-Pilot readability, AI Edit intelligence, and a Session action

Three changes only. The AI Builder is not touched anywhere in this work.

## 1. Co-Pilot chat shows classroom mathematics

Today the Co-Pilot panel prints its reply as plain text, so anything mathematical
arrives as raw markup (`A \cup B`, `\{1,2,3\}`, `\frac{a}{b}`). The lesson note
itself already has a proper mathematical renderer; the chat will use that same
renderer, so the draft reads as `A ∪ B`, `{1, 2, 3}`, stacked fractions, roots,
indices, Greek letters, matrices, set and statistics notation. Nothing is
stripped — it is parsed and drawn.

## 2. AI Edit gains the same knowledge as Co-Pilot

AI Edit stays exactly where it is (the toolbar that appears on a highlight) and
stays an editor. What changes is what it knows. Co-Pilot's solving standards
(worked-solution benchmark, teaching reference, completeness rules, the shared
maths engine knowledge) are collected into one shared knowledge layer that both
Co-Pilot and AI Edit load. So "generate the solution" on a highlighted question
produces a full classroom solution — understanding, method, working line by
line, explanation, final answer — not a bare answer line.

AI Edit also receives the surrounding lesson context (topic, the question above,
tables, diagrams, an existing solution) so it can complete what is missing while
still changing only what the teacher highlighted. Highlighting an existing
solution and asking to improve it corrects and completes it rather than
replacing the mathematics wholesale.

## 3. A Session action beside AI Edit

A Session button joins AI Edit in the same highlight toolbar. The teacher types
content by hand, highlights it, presses Session, and the selection becomes a
real lesson Session — the same structure the note, Present, the Smartboard and
session navigation already expect. The heading type is honoured when the
selection starts with one (Example, Solution, Classwork, Exercise, Explanation,
Summary, Conclusion); otherwise it becomes a general session. The selection is
converted in place: no duplicate copy, nothing lost, all mathematics preserved.
