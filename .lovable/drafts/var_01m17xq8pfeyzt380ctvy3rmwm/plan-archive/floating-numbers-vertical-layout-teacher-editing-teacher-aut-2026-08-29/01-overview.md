# Floating Numbers — vertical layout, teacher editing, teacher authority

Three fixes to the existing Floating Numbers pipeline. Nothing in the Smartboard reader changes; it keeps consuming the same saved structure, joined by permanent line identity.

## What is actually wrong today

1. **Horizontal strip.** On the Floating Highlighting page every solution line is rendered as a single non-wrapping row with its own horizontal scrollbar (`whitespace-nowrap overflow-x-auto` per line). A long line such as `2x² + 5x − 3 = 0` therefore runs off to the right instead of wrapping inside the page, and the teacher has to scroll sideways to read it. The line data is already line-by-line — only the rendering forces one horizontal string.
2. **No line-level editing.** The alignment page lets the teacher edit individual chips (add / edit / remove a filler or symbol) but there is no way to delete a whole generated line, duplicate one, copy a line, paste a corrected line, or move a line up/down.
3. **Generate overwrites teacher corrections.** "Generate Floating Numbers" rebuilds every text line from the AI response and replaces the saved fillers/symbols. The previous state is archived, but a teacher's hand-corrected line is still silently replaced on the next Generate.

## What will change

- **Vertical, wrapping worksheet.** Solution lines wrap within the page width on both the Highlighting page and the alignment page; no per-line horizontal scrollbar. Only genuinely wide objects (tables, matrices, diagrams) keep their own contained scroll area. Works down to tablet width and up to Smartboard displays.
- **Line controls on the alignment page.** Each numbered line gets a small control row: Delete line, Copy, Paste, Duplicate, Move up, Move down — plus the existing per-chip edit/remove and an Add line action. Incorrect generated content is shown, never hidden, so the teacher can see what MathGPL produced and correct it.
- **Structure-preserving copy/paste.** Copying a line writes a structured payload (its fillers, symbols/containers and equation text) alongside readable plain text, so pasting restores real floating-number objects rather than a text blob. Pasting plain text from elsewhere is parsed with the existing math tokenizer so terms stay whole — `A − B` keeps its minus, and a first term never gains an artificial leading `+`.
- **Teacher authority.** A line the teacher edits is marked as teacher-owned and saved that way. Generate then leaves those lines untouched and reports how many it skipped, with an explicit "regenerate this line anyway" action per line. The teacher's saved version is what the Smartboard reads.
- **Activity scoping unchanged.** Floating data continues to live on its own subsection (Example 1, Exercise 1, Classwork, Homework), keyed by permanent line identity — no cross-activity mixing is introduced.
