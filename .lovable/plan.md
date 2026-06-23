## Goal

Reposition the Floating Number AI from a **generator** to a **precision editor** that obeys the teacher's instructions literally. The generator on the page already produces a first pass; this AI's job is to make targeted fixes — "change the +4 on line 6 to +4x", "put a square root on line 4 as the 5th floating number", "1/4 is one fraction, don't split it" — and apply them through the existing preview → Apply Changes flow.

## Problems observed

1. The assistant still treats requests as generation tasks (proposes whole new chip sets, asks for verification, walks through reasoning) instead of just doing the edit.
2. Fractions like `1/4` get torn apart into separate chips — the AI doesn't honor the teacher's intent to keep a unit together.
3. No clear "line 6, 5th floating number" addressing — the AI can't reliably target a specific filler position without a highlight.
4. The preview → Apply flow exists (`apply_line_update`, `apply_chips`, `replace_line`) but isn't surfaced consistently; some edits should land as a single visible diff card the teacher confirms with one click.

## Plan

### 1. Rewrite the AI's role (system prompt in `supabase/functions/floating-assistant/index.ts`)

- New top-of-prompt section: **"YOU ARE A FLOATING-NUMBER EDITOR, NOT A GENERATOR."**
  - The page's generator already runs first. The AI only modifies what already exists.
  - Default action for any instruction: pick the smallest targeted tool (`move_filler`, `add_filler`, `remove_filler`, `add_container`, `remove_container`, `set_arrangement`) — never `generate_line_structure` or `apply_chips` unless the teacher explicitly says "regenerate the whole line".
  - "Follow the instruction literally. Do not re-derive, do not re-verify, do not reason out loud about laws unless asked." Skip the LAW#/DOC# citations on simple edits.
  - Fraction integrity rule: `a/b`, `\frac{a}{b}`, and any expression the teacher refers to as a single unit must stay as one filler. Never split a fraction across chips.

### 2. Teach the AI line + position addressing

- Pass a compact **line map** in `lessonContext` for every request: `[{ lineIndex, lineId, equation, fillers: [{i, value}], containers }]`.
- Prompt rules:
  - "line 6" → resolve to `lineIndex === 5` (1-based for humans).
  - "the 5th floating number" / "5th position" → `from_index`/`to_index`/`index` = 4.
  - "the +4" / "the square root" → match by value first, fall back to position.
  - If both a highlight and a verbal address are given, the highlight wins.

### 3. Make the edit flow one click: instruction → diff card → Apply

Inside `AssistantPanel.tsx`:

- Render every `apply_line_update` / `apply_chips` / `replace_line` action as a compact **diff card**:
  - Title: a one-line plain-English summary (the AI's `reason`, e.g. *"Change `+4` to `+4x` on line 6, position 5"*).
  - Body: before → after of the affected filler(s) only, rendered with `renderMathInline`.
  - Single primary button: **Apply Changes**. Secondary: Dismiss.
- Drop the verification-pass requirement for targeted edits (move/add/remove/replace one filler). Keep it only for full `apply_chips` regenerations.
- When the AI returns multiple small actions for one instruction, stack them in one card with a single Apply button that runs them in order.

### 4. Force `reason` on every tool call

- Add `reason` as a required tool parameter on `move_filler`, `add_filler`, `remove_filler`, `add_container`, `remove_container`, `set_arrangement`, `replace_line`. The frontend uses this as the diff card title — no `reason`, no card.

### 5. Honor "keep this together" intents

- In `applyLineUpdateFromAssistant` (FloatingNumbersPage.tsx), stop running `dropContextualLeadingPlus` / re-detecting structures on `apply_line_update`. Apply the AI's filler value verbatim. Re-detection only runs on full regeneration.
- Backend prompt: when the teacher says "this is one fraction", "keep together", "don't split", emit a single `replace_line` (or single `add_filler`) preserving the unit literally.

### 6. Welcome message + quick actions

- Update the welcome message to: *"I'm your floating-number editor. Tell me what to change — by line, position, or value — and I'll show you the diff. Examples: 'on line 6, change +4 to +4x', 'put √ as the 5th floating number on line 4', 'keep 1/4 as one fraction'."*
- Replace the "Generate" quick action with "Regenerate this line" (only active when a line is selected) and add "Fix line 6…" style prompt templates.

## Technical details

- Files touched:
  - `supabase/functions/floating-assistant/index.ts` — system prompt rewrite, tool schemas gain required `reason`, line-map in context, fraction-integrity rule.
  - `src/components/floating/AssistantPanel.tsx` — diff card rendering, drop verification gate on targeted edits, welcome + quick actions.
  - `src/pages/FloatingNumbersPage.tsx` — stop post-processing filler values on `apply_line_update`; build and pass the line map into `lessonContext`.
  - `src/lib/floating/lessonContext.ts` — extend `LessonContext` type with `lineMap`.
- No DB migrations. No new tables. Existing `floating_chip_snapshots` undo continues to work.
- Out of scope: changing the generator itself, retraining laws, voice recording (already working).
