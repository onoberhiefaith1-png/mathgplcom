# Three fixes: no raw syntax, Solution before solving, readable section list

## 1. No raw syntax or LaTeX on the page

Your screenshot shows lines like `3 + \sqrt{2}` and `1 × (3 - \sqrt{2})` printed as
literal text next to properly stacked fractions. So the maths is arriving in template
form and only *some* lines are being converted; the rest land as prose and the backslash
command shows.

Two-sided fix:

- **Tell the engine plainly**: no raw syntax, no LaTeX, no `sqrt`, no `**`, no `a/b`
  fractions, no code fences — mathematics must be written in classroom structure only.
  The rendering standard currently *permits* `\frac{}{}` / `\sqrt{}` as internal
  templates, which is what invites `\sqrt{2}` into ordinary sentences. Templates stay
  allowed only inside a maths line; a sentence must carry real symbols (√2, ×, ÷, π, x²).
- **Make it impossible to display**: any line that still contains a backslash command is
  converted to real maths structure before it enters the note, including inside a
  sentence. If a fragment genuinely cannot be structured, the item is regenerated rather
  than printed as source. A validator rejects any generated block whose visible text
  still contains `\`, `sqrt(`, `**` or `^` outside a rendered power.

## 2. Every question is followed by a written "Solution" before the working

Standard lesson-note shape, enforced for Example, Classwork, Exercise, Homework,
Assignment, Assessment and Practice:

```text
Example 1
<the question, written out in full>
Solution
<step, step, step …>
```

The Solution heading already exists as a placeholder, but the engine sometimes writes
its working straight after the question, or restates the label inside the body where it
gets stripped. The fix guarantees the heading is present, numbered to match the question,
and always sits between the question and the first working line — never inside the
working, never missing, never duplicated.

## 3. The section list on the right must be black and readable

The build/section list is drawn at 40–80% foreground opacity on a light card, which is
why the entries (Introduction, Explanation, Example, Example 2, Classwork …) look blurred
out. Those rows move to full-contrast foreground ink at a readable size, with only the
status icon carrying colour. Completed, pending and running states stay distinguishable
by icon rather than by fading the text.
