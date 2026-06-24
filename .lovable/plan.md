## Goal

Replace the current "AI-generates / teacher-corrects-chips" loop with **Highlight Generation**: the equation itself becomes the source of truth. The teacher clicks tokens inside the equation, presses Enter, and the system creates, merges, or splits the Floating Numbers automatically — with a strict one-to-one map between equation tokens and chips.

This same workflow powers both:
- **Manual generation** (no AI involved)
- **AI correction** (fix what the generator got wrong)

## Core model

Every equation is parsed once into an ordered list of **atoms** — the smallest selectable units. Each atom carries:

- `atomId` (stable per line)
- `kind`: `number | variable | operator | bracket | fraction-bar | root-sign | exponent | subscript | prime | vector-arrow | function-name | …`
- `value` (verbatim text/LaTeX)
- `groupHint`: which container/attachment it belongs to (e.g. the `²` knows its base, the fraction bar knows its numerator/denominator regions)

Every Floating Number (chip) stores `atomIds: string[]` — the atoms it was built from. This is the one-to-one map used for:
- Click an atom → highlight the chip(s) containing it.
- Click a chip → highlight the atoms it covers.
- Merge/split operations always work in atom-space, then re-render chips.

## Interaction model

1. Teacher clicks atoms in the equation. Selection is multi-select, toggled per click. Selected atoms are visually marked in the equation.
2. Teacher presses **Enter** (or a visible "Apply" button on touch).
3. The system runs one rule:
   - Find the existing chips that overlap the selected atom set.
   - Remove those chips.
   - Create new chip(s) from the selected atoms, **splitting on contiguity gaps in the original equation order** (disconnected selections → multiple chips).
   - Re-render. No duplicates.

Pressing Enter with no selection is a no-op. Esc clears selection.

## Connectivity rule

Two selected atoms are part of the same new chip only if every atom **between** them in the original equation is also selected. Otherwise the selection splits at the gap — covering examples 2, 3, 8, 9 in the spec.

## Attachment vs container structures

Two structure classes, treated differently when partially selected:

**Attachment structures** — `exponent`, `subscript`, `prime`, `vector-arrow`. Selecting only the attachment keeps its visual form (`²`, `₁`, `'`, `⃗`). Never converts `x²` into `x 2`. No placeholder is inserted for the missing base.

**Container structures** — `fraction`, `root`, `bracket`, `integral`, `matrix`, `summation`, `limit`. Selecting the container marker alone (e.g. just the fraction bar, just `√`, just `(`) produces an **empty container with `□` placeholders** that auto-expand to fit content. Partial selection (numerator selected, denominator not) → placeholder for the missing side. The teacher never resizes; layout grows with content.

A small registry maps each structure to:
- its marker atoms
- its content regions
- a render template with `□` placeholders
- attachment vs container flag

## Highlighting (one-to-one)

- Hover/click an atom → all chips whose `atomIds` include that atom get a highlight ring.
- Hover/click a chip → its atoms in the equation get the same ring.
- Because identity is by `atomId`, "the x inside Ax²" and "the x inside Bx" are distinct atoms and only their own chip lights up (example 18).

## AI integration (correction, not generation)

The AI Assistant stops emitting `apply_chips` / `apply_line_update` blobs. Instead it returns **atom-selection instructions** the system replays through the same Enter pipeline:

- `select_atoms({ lineId, atomIds, then: "apply" })` — selects atoms then presses Enter.
- `clear_chips({ lineId })` and `select_all({ lineId })` for "regenerate this line as one chip".

This guarantees the AI can never produce a chip state the teacher couldn't have produced by clicking. The existing diff-card preview still appears: it shows the resulting chip change and a single Apply button.

## UX changes on the Floating Numbers page

- Each equation row renders as a row of clickable atom spans (replaces the current KaTeX-only inline render). KaTeX is still used for visual fidelity per atom (`²`, `√`, fraction bar) but each atom is wrapped in a span with `data-atom-id`.
- A subtle "Enter to apply" hint appears whenever atoms are selected, plus a small floating Apply button for tablet/touch.
- Floating chips render unchanged visually, but each chip now carries the highlight ring behavior.
- Quick actions in the assistant become: "Select all on this line", "Clear chips on this line", "Undo last change" — plus free-text instructions which the AI translates to atom selections.

## Edge cases covered (matches spec examples)

- Single atom click → single chip (Ex 1, 4).
- Two atoms with gap → two chips (Ex 2, 9, 11).
- Connected selection → one chip (Ex 3, 5, 8).
- Splitting an existing chip by selecting a subset → original removed, new chips for selected + remaining (Ex 6, 7).
- AI correction collapses three chips into one without duplicates (Ex 17).
- Empty container creation from marker-only selection (Ex 12, 14, 15).
- Containers auto-expand with content; attachments preserve visual position (Attachment/Container section).

## Technical details

Files / modules:

- `src/lib/floating/atoms.ts` (new) — equation → atom list parser. Builds on `src/lib/floating/elementDetector.ts` but emits stable `atomId`s and group hints for attachments/containers.
- `src/lib/floating/structures.ts` (new) — registry of attachment vs container structures, render templates with `□` placeholders, expansion rules.
- `src/lib/floating/highlightEngine.ts` (new) — pure functions: `applySelection(atoms, chips, selectedAtomIds) → chips'`. Implements merge / split / connectivity / no-duplicate rules. Fully unit-testable.
- `src/components/floating/EquationAtoms.tsx` (new) — renders an equation as clickable atom spans, manages per-line selection state, fires Enter / Apply, and exposes hover for chip↔atom highlighting.
- `src/components/floating/FloatingChip.tsx` (extracted from `FloatingNumbersPage.tsx`) — chip view that listens for highlight events keyed on `atomId`.
- `src/pages/FloatingNumbersPage.tsx` — swap inline `renderMathInline(equation)` for `<EquationAtoms>`; persist `atomIds` on each chip in `notebook_subsections.floating_lines` JSON (additive, backward-compatible — chips without `atomIds` get re-derived once on load).
- `src/components/floating/AssistantPanel.tsx` — drop generation tools, keep diff card; translate AI replies into `select_atoms` operations replayed through the engine.
- `supabase/functions/floating-assistant/index.ts` — system prompt becomes "return atom selections only"; new tool schema `select_atoms` / `clear_chips` / `select_all`; remove `apply_chips`, `apply_line_update`, `replace_line`, `generate_line_structure` from the public tool list.
- Tests: `src/test/floatingHighlightEngine.test.ts` (new) — every spec example becomes a test case (Ex 1–18 plus attachment/container cases).

Persistence:

- Existing `floating_lines` JSON gains `atomIds: string[]` per chip. Old data without `atomIds` is migrated lazily on first render of each line by re-tokenising the equation and best-effort matching chip text → atom span.
- No DB schema migration required (JSON column).
- `floating_chip_snapshots` undo continues to work; snapshots now also store `atomIds` for full fidelity.

Out of scope:

- Changing the generator that produces the initial AI chips (it stays; teachers can still trigger it, but it's now optional).
- Voice input (unchanged).
- Smartboard rendering.
- Mobile gesture redesign beyond the touch Apply button.
