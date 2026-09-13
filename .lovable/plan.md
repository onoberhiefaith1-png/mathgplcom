# Teach the Copilot to build real MathGPL tables

Goal: whenever mathematics is naturally rows and columns, the lesson generator must produce a real editable Smart Table, never `{array}`, `| x | f | fx |`, or space-aligned text. This is a permanent generation rule across every topic, not a fix for the statistics lesson.

The platform already has the table system (Smart Table node, Maths Table assets, the `[[tool:smartTable …]]` directive and its materializer). Nothing new is built; the AI side is corrected so it uses what exists.

## What is actually wrong today

1. **Pipe tables are silently flattened before anyone checks them.** The generator cleans its own output first (markdown clean-up turns `| x | f | fx |` rows into space-separated text), and only then runs the "you typed a table by hand" guard. By that point the pipes are gone, the guard sees nothing wrong, and a flattened pseudo-table is written into the note. This is the main cause of the statistics screenshots.
2. **`array` layouts are not treated as tables at all.** A LaTeX-style `array` environment with column specs reaches the page as visible junk instead of triggering the table rule.
3. **The table rule only exists on some entry paths.** Full-section generation and AI edit carry the workspace rules; the Copilot's own planning/blueprint/question stages do not, so a planned "frequency table" item is described in prose and then generated as text.
4. **The guard gives up too easily.** It retries once and accepts the result even when the table is still typed by hand.
5. **No topic-level table awareness.** The rules say "every table must use Smart Table" but never teach *when* a table is the correct representation, so the model only complies when the word "table" appears.

## The work

**1. Detect the table before cleaning it**
Capture hand-typed table structures (pipe rows, `array` environments, ASCII-ruled grids, repeated aligned columns) on the raw model output, before markdown clean-up can erase the evidence. The cleaner keeps working as it does for everything else; it simply no longer hides tables from the guard.

**2. Make the guard binding**
Treat a hand-typed table as a hard structural defect: correct it with explicit instructions naming the exact headers and rows detected, and repeat the correction round (up to a small limit) until the output carries a real table directive. Accept flattened text only as a last resort, and record it as a warning rather than passing it off as correct.

**3. Convert unmistakable tables instead of losing them**
When the model still returns clean pipe rows or an `array` with a consistent column count, deterministically rewrite them into a `[[tool:smartTable headers="…" rows="…"]]` directive rather than flattening. Ambiguous or single-column content is left as prose, unchanged.

**4. Teach *when* a table is right (the new rule)**
Add a Table Recognition standard to the generation rules — a general principle plus a topic map covering number/arithmetic, algebra and functions, sequences, logarithms and antilogarithms, trigonometric ratios, statistics (frequency, grouped, cumulative, `x, f, fx, x², fx²`), probability and sample spaces, coordinate geometry and plotting values, geometry/mensuration/measurement, unit conversion, financial mathematics, applied rate/ratio work, and matrices via the matrix structure. It states explicitly that the trigger is the mathematical structure, not the word "table": "find y when x = −2 … 2", "calculate x² and fx for each frequency", "list factors of both numbers" each require a table. Column headings, computed columns, totals and units belong inside the table's cells, never in prose.

**5. Apply the rule on every Copilot path**
Attach the workspace and table-recognition rules to the Copilot planning, blueprint and question stages as well as section generation and AI edit, so a blueprint that plans a frequency table is built as one.

**6. Keep mathematical notation inside cells**
Cell values keep going through the existing math conversion so powers, fractions, roots, symbols, units, negatives and percentages render properly (`fx²` as real mathematics), using the same path as a teacher-inserted table — which is what makes it editable, savable, and identical in Present, Smartboard, class boards, assignments and student view.

**7. Existing lessons**
Nothing is rewritten automatically. Regenerating an affected section now produces a real table; unrelated saved content is untouched.

## Verification

- Unit tests: pipe rows, `array` environments and ASCII grids all become one Smart Table directive; single-column and prose content is not converted; the materialised node matches what the teacher's own Insert Table button produces.
- Recognition tests across the topic list (frequency, extended frequency, table of values, sequence terms, trig ratios, logarithm/antilog, HCF/LCM factors, probability outcomes, x/y coordinates, mensuration, unit conversion, financial calculation).
- Live check: generate a statistics section and confirm the note shows an editable table with `Number of Goals (x) | Frequency (f) | fx | x² | fx²` and correct values, then confirm it survives save, Present and the classroom board.

## Out of scope

No second table implementation, no change to the Smart Table component or the Lesson Notes editor, no redesign of existing tables, and no change to the geometry, floating-number or solution-integrity systems.
