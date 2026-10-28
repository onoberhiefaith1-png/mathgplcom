# Lesson-note precision pass: solved questions, intact labels, real math

Three defects, one polish pass. Nothing in the generator's overall design changes.

## 1. Broken "Solution" label

Your screenshots show a heading rendered as a lone `S` followed by `olution 1`, and a
section list containing entries like `S`, `olution 1`, `S 2`, `olution 12`. So the label
text is being split into two nodes somewhere on the AI-text-to-document path.

The exact splitting point is not yet confirmed. What is confirmed by reading the code:

- Heading numbering (`applyAutoNumbering`) only rewrites a heading whose whole content is
  one plain text node, and writes the full string `Solution N` — it does not itself split words.
- AI text is converted line-by-line into math blocks and prose paragraphs, and a
  two-column packer then moves prose and math into separate cells. A label mistakenly
  treated as part-math / part-prose lands exactly as the screenshots show.

So step one is a failing test that reproduces the split from real generator input, then the
fix at the confirmed point: a structural label line (`Solution`, `Solution 2`, `Example 3`,
`Classwork 1`, …) is a heading, never math, never packed into a solution row, and never
partially converted. Section labels then get a hard guarantee: label text in, identical
label text out.

## 2. Every question individually sectioned and completely solved

One detected solvable unit = one numbered section = one complete solution, across
examples, classwork, exercises, homework, assignments, assessments and practice.

- Question detection decomposes multi-part items ("(a) … (b) …", "1. … 2. …",
  comma-joined problem lists) into individual solvable units instead of one grouped block.
- The outline emits `Item N` + its own `Solution N` for every unit — never a shared
  generic heading with one detached solution.
- Pairing keeps a strict one-to-one owner link between a question and its solution.
- Structure validation runs before generation is reported complete and fails on any
  grouped, duplicated-number, unpaired or empty solution. Failures are repaired and
  re-validated rather than silently shipped.

## 3. Mathematical rendering and readability

Confirmed cause of the blank fraction bars with digits dangling beside them: the display
gate replaces a fraction it cannot brace-match with an empty two-slot shell and then
resumes reading just after the command name, so braceless TeX like `\frac12` renders as an
empty fraction followed by the text `12`.

Fix the gate to read braceless and single-token arguments (`\frac12`, `\frac ab`,
`\sqrt2`, `x^2`, `a_1`) and to consume whatever it repaired, so no operand ever leaks into
prose. Same treatment for exponents, radicals, subscripts, sums/products, integrals,
limits and matrices already listed in the structure tokenizer — meaning is preserved, never
approximated.

Readability: solution/feedback and problem-check text moves to full-contrast foreground
tokens at readable size, so verification text is legible on the dark editor surface.
