# Floating Number AI – Smart Context Capture

Rework the right-side AI Assistant so it behaves like a true workspace copilot tied to whatever the teacher highlights on the page.

## 1. Remove blurred context preview
- In `AssistantPanel.tsx`, the "Current selection" strip currently shows a single string with no styling guarantees. Replace it with a clear, scrollable **Selected Context** block:
  - Solid background, normal text color (no blur/opacity/filter).
  - Monospace math rendered via `renderMathInline` so symbols, exponents, scaffolds are legible.
  - Each captured item shown as a numbered card `[1]`, `[2]`, …

## 2. Auto-capture highlights from the page
- Add a global selection listener in `FloatingNumbersPage.tsx` (`document.addEventListener("selectionchange")` + `mouseup`) scoped to the left/middle workspace container.
- On a non-empty selection inside the workspace:
  - Capture `window.getSelection().toString()` plus the nearest equation line id (via `data-line-id` we already render).
  - Push it into a new `capturedContext` state: `{ id, text, lineId?, pinned: false, ts }[]`.
- Debounce so quick drag-selects don't spam entries; replace the last unpinned entry if the new selection starts within ~400ms of the previous one.
- No copy/paste required.

## 3. Multiple selection support
- `capturedContext` is an array. Each new highlight appends a new `[n]` card unless it duplicates the most recent unpinned entry.
- Render all items in the **Selected Context** block, numbered.

## 4. Context management controls
Add a compact toolbar above the messages list:
- **Pin** (per item) – toggles `pinned`. Pinned items survive "Clear".
- **Remove** (per item) – deletes that entry.
- **Replace** – next highlight overwrites the most recent unpinned entry instead of appending.
- **Clear context** – drops all unpinned entries.

## 5. Live context injection into prompts
- On Send, build the outgoing payload as:
  ```
  { message, selections: capturedContext.map(c => ({ id, text, lineId })), lineId: activeLineId, history }
  ```
- Update `supabase/functions/floating-assistant/index.ts` to accept `selections[]` and inject them into the system context block as:
  ```
  SELECTED_CONTEXT:
    [1] <text>
    [2] <text>
  ```
- Keep backward-compat: if `selections` is empty, fall back to current single `selection`.
- Tools (`generate_chips`, `verify_chips`) keep operating on a single selection; when multiple are captured, the assistant picks the one referenced by the teacher's message (or `[1]` by default) and tells the teacher which it used.

## 6. Smart equation recognition (Detected Elements)
- Reuse `src/lib/floating/elementDetector.ts` (`detectElements`) client-side for instant feedback.
- For the **most recent** captured item, render a collapsible **Detected Elements** card beneath the context list:
  - Variables, Coefficients, Operators, Functions, Scaffolds (fractions/roots/powers/logs/integrals/matrices), Existing floating numbers.
  - Detected via `detectElements` + lightweight structure tags from `detectStructures` (already imported in the page) to label "Polynomial", "Rational", etc.
- Purely presentational; no server round-trip.

## 7. Workspace-mode quick actions
Below the composer, add a row of one-tap action chips that prefill the input (still routed through the existing tool-calling assistant — no new tools):
- Explain · Generate · Verify · Restructure · Apply Law · New Law · Compare · Coverage

Each chip sends a templated instruction like `Verify the selected context against current chips.` with `selections` attached.

## Files

**Edit**
- `src/components/floating/AssistantPanel.tsx` – new context model, no blur, multi-card list, pin/remove/replace/clear, detected-elements card, quick-action chips, send selections.
- `src/pages/FloatingNumbersPage.tsx` – `selectionchange`/`mouseup` listener scoped to the workspace, `capturedContext` state lifted, passed to `AssistantPanel` with setters; ensure equation rows expose `data-line-id`.
- `supabase/functions/floating-assistant/index.ts` – accept `selections[]`, inject into system context, keep `selection` fallback; choose active selection for tool calls.

**No new tables, no new edge functions, no routing changes.** Verification guarantees and the existing apply/undo approval flow are unchanged.

## Out of scope (this round)
- Voice / image attachments (already exists or deferred).
- Persisting captured context across reloads.
- New laws workflow UI beyond the existing AI Settings page.
