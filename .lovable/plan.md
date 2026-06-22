# Floating Number AI — Readability + Live Selection Sync

Two scoped fixes to `src/components/floating/AssistantPanel.tsx` and the selection capture in `src/pages/FloatingNumbersPage.tsx`. No backend or business-logic changes.

## 1. Readability — white background, black text

Rewrite all inline `style={{ background: ..., color: ... }}` blocks and Tailwind classes in `AssistantPanel.tsx` so every surface follows:

- Panel root, header, lesson strip, selected-context area, message list, composer, footer: `background: #FFFFFF`.
- All primary text (selection text, AI replies, reasoning, generated floating numbers, teacher notes, detected elements, chips, labels): `color: #000000`.
- Section labels ("Selected Context", "Lesson", "Detected Elements"): black, slightly smaller — no muted grey.
- Borders/dividers: solid light grey (`#E5E7EB`) — visible but not decorative.
- User vs assistant messages: both black-on-white. Differentiate with a 2px left border (user = blue `#2563EB`, assistant = neutral `#111827`) and a small role label — no colored bubbles, no translucency.
- Buttons/chips: white background, black text, `#D1D5DB` border; hover = `#F3F4F6`. Active "Replace" toggle = black bg / white text (kept as the only inverted control).
- Code/math snippets inside selections: black text, `#F9FAFB` background, `#E5E7EB` border, monospace.
- Remove all `text-foreground/55`, `text-foreground/65`, `opacity-*` on text, `hsl(... / 0.x)` text colors, and gradient/translucent backgrounds inside the panel.

Audit checklist before finishing: grep the file for `foreground/`, `opacity-`, `hsl(`, `/ 0.` and confirm no text token uses transparency.

## 2. Live single-selection sync (default) + Multi-Selection mode

### Selection capture (`FloatingNumbersPage.tsx`)

Replace the current `mouseup`-based, append/dedupe/debounce logic with a simpler `selectionchange` listener:

- Listen on `document` for `selectionchange`.
- Read `window.getSelection()`. If collapsed → if Multi mode off, **do nothing** (keep current selection visible — fixes the "second highlight clears it" bug). If selection exists and anchor is inside `workspaceRef`:
  - Resolve `data-line-id` from anchor's `closest`.
  - In **single mode (default)**: replace `capturedSelections` with one entry `[{ id, text, lineId, pinned: false, ts }]` — every new highlight instantly swaps A → B → C.
  - In **multi mode**: append (dedupe by identical text+lineId), preserving pinned items.
- Drop the `replaceModeRef` / 400 ms debounce logic; single mode makes them unnecessary.
- A new `selectionMode: "single" | "multi"` state lives on the page and is passed to `AssistantPanel` along with a setter.

### Panel changes (`AssistantPanel.tsx`)

- Add a top "Current Selection" strip that's always visible (even when empty → shows "No selection — highlight any equation on the left").
- Render the active selection as a clear black-on-white card with the verbatim text in monospace, line-by-line, plus the `lineId` badge.
- Replace the existing `Replace` toggle with a `Single | Multi` segmented control bound to `selectionMode`. Pin/Clear/Remove controls only appear in Multi mode.
- Detected Elements, Applicable Laws (existing chips), Available Commands (quick action chips), and Selected Structure recompute via the existing `useMemo` keyed on the current selection — already reactive, just confirm they read from the new live selection.
- Keep all existing assistant features (lesson context strip, quick actions, draft-law approve/reject, apply/undo). Only styling + selection-state logic changes.

## Files touched

- `src/components/floating/AssistantPanel.tsx` — colors + selection UI (Current Selection strip, Single/Multi toggle, remove translucent text).
- `src/pages/FloatingNumbersPage.tsx` — replace `mouseup` capture with `selectionchange`-based live sync; add `selectionMode` state.

## Out of scope

- Edge function, lesson context, law library, completeness gate — unchanged.
- No new tables, no new routes.
