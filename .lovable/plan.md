# Keyboard-First Quick Insert & Asset Library Enhancements

Ten related improvements. Grouped into three implementation waves so each can be verified independently.

---

## Wave 1 — Quick Insert (@) power features

**1.1 Trigger `@` anywhere**
`src/components/lessonnotes/extensions/AtCommand.ts` currently requires `(?:^|\s)@` before the token. Change the regex to `@([\w-]*)$` so `x@FR`, `ABCD@SQ`, `2x+3@TB` all activate the menu. Nothing else in the plugin needs to change — `from`/`to`/coords already come from the caret.

**1.2 Quick matrix — `@mat{R}x{C}` + Enter**
In `AtCommandMenu.tsx` `onKey` handler, before the short-code fast-path, detect `/^mat(\d+)x(\d+)$/i` on `state.query`. On Enter, insert a matrix asset directly (bypass MatrixCreateDialog) with `rows`, `cols`, default `br: "["`. Clamp to 1–10 each.

**1.3 Repeat last asset — `@@` + Enter**
Add a lightweight `lastInsertedAsset` store (module-scoped ref in `src/lib/lessonnotes/assets/recents.ts`, persisted to `localStorage`). Every `insertAsset` call updates it. In `AtCommandMenu`, if `state.query === ""` and the raw text at `state.from..state.to` is `@@`, Enter inserts the stored last asset. To detect `@@`, relax the AtCommand regex to also match a second `@` as a literal query char, OR simpler: when caret is right after `@@`, treat it as `active` with a synthetic `query = "__repeat__"`. Cleanest: in the plugin, if the text before caret matches `@@$`, emit `{active, query: "@"}` — then the menu maps query `"@"` to repeat-last.

**1.4 `@favorite` and `@recent` virtual queries**
Reserved queries handled in the menu ahead of `searchAssets`:
- `@favorite` (or its user-defined alias) → results = assets flagged in favourites store.
- `@recent` → results = last 10 assets from recents store (see 1.3), newest first.
Both aliases are editable in a small settings dropdown on the library ⋮ menu; stored in `localStorage` under `assetCommandAliases`.

---

## Wave 2 — Math keyboard shortcuts

New TipTap extension `src/components/lessonnotes/extensions/MathKeyShortcuts.ts` installed alongside `AtCommand`.

**2.1 Superscript on Shift-hold (single next char)**
This must not conflict with normal capitalisation. Design: teacher presses and releases Shift **with no other key**, then the next printable character becomes superscript. Implementation: `keydown` records `Shift` press with no accompanying key; `keyup` on Shift with `event.getModifierState` history clean = arm superscript mode for one character. Next `input` / `keypress` maps the char via a superscript table (`0-9`, `+`, `-`, `=`, `(`, `)`, `n`, `m`, `i`, `x`, `a`, `b`, etc.), replaces the just-inserted char with the Unicode superscript (`²`, `ⁿ`…), and disarms. Fallback: unmapped char inserts normally.

**2.2 Subscript on Ctrl-hold (single next char)**
Same pattern with `Control`; Unicode subscript table (`₀-₉`, `ₙ`, `ᵢ`, `ₐ`, `ₑ`…). Skip when the Ctrl press was part of a shortcut (Ctrl+C, Ctrl+V, Ctrl+Z etc.) — detect by "Ctrl went down and up alone with no other key in between".

**2.3 Smart bracket pairing**
Same extension. On `keydown` for `(`, `[`, `{`, `|`, `⟨` (and Shift-9 producing `(`), insert the pair and move caret between. Handle:
- Already-selected text → wrap it.
- Typing the matching closer when caret is immediately before it → skip insertion (standard "overtype closer").
- `Backspace` immediately after autopair removes both.

**2.4 Smart fraction on `/`**
On `/` keypress, scan backwards in the current text node to isolate the "last mathematical term": walk back while chars are alphanumerics, `.`, `^`, `_`, `(`…`)` balanced, digits, single letters; stop at whitespace, `+`, `-` (binary), `*`, `=`, `,`. Replace that run with a `mathInline` node holding `\frac{run}{}` and place caret in the denominator. If the run is empty (e.g. `+/`), fall back to a plain `\frac{}{}` insert. Reuses existing `mathInline` node + `renderMathInline`.

---

## Wave 3 — Asset Library management

**3.1 Favourites + Recents store**
`src/lib/lessonnotes/assets/favorites.ts` and `recents.ts`: localStorage-backed sets/lists keyed by asset `id`. Exports: `isFavorite`, `toggleFavorite`, `listFavorites`, `pushRecent`, `listRecent(n)`, `getLastInserted`. `insertAsset` (in `src/lib/lessonnotes/assets/insert.ts`) calls `pushRecent(assetId)` on every insertion — this powers 1.3, 1.4, and the library ⋮ menu.

**3.2 Per-asset ❤️ toggle on the card**
`AssetLibraryDialog.tsx` asset card: add a small heart button top-right, separate from the existing ⋮ button. Filled red when favourited, outline otherwise. One-click toggle, no popover.

**3.3 Per-asset ⋮ menu — Standard Name + Short Code only**
The existing edit popover already edits Standard Name + Short Code — keep as-is, just confirm it no longer shows anything else. (It doesn't.)

**3.4 Library-level ⋮ menu**
Add a ⋮ button on the dialog header with three view modes:
- **Favourites** → filter grid to `listFavorites()`.
- **Recent** → grid = `listRecent(10)` in order.
- **Repeat Last** → grid = `[getLastInserted()]` (or empty state).
Selecting a mode sets a `viewMode` state in the dialog; picking "All" clears it. Search box remains active within the filtered view.

---

## Technical notes

- **Files created:**
  `src/lib/lessonnotes/assets/favorites.ts`
  `src/lib/lessonnotes/assets/recents.ts`
  `src/components/lessonnotes/extensions/MathKeyShortcuts.ts`
- **Files modified:**
  `src/components/lessonnotes/extensions/AtCommand.ts` (regex, `@@` detection)
  `src/components/lessonnotes/AtCommandMenu.tsx` (matrix shortcut, repeat, favorite/recent virtual queries)
  `src/lib/lessonnotes/assets/insert.ts` (call `pushRecent`)
  `src/components/lessonnotes/AssetLibraryDialog.tsx` (❤️ button, library ⋮ menu, viewMode filter)
  Editor bootstrap file that registers `AtCommand` — add `MathKeyShortcuts` alongside.
- **Unicode tables** live inline in the shortcut extension; only characters with real Unicode super/sub glyphs are mapped. Unmapped chars fall through to normal typing (no fake formatting).
- **No backend changes.** Favourites, recents, and command aliases are per-device localStorage.
- **No changes to bar/histogram/pie/graph work.** This is purely input-layer and library-UI.

---

## Out of scope for this plan (say if you want them included)

- Cross-device sync of favourites/recents (would need a Cloud table).
- Superscript/subscript for characters that have no Unicode equivalent (would require switching those to `mathInline` nodes instead of plain text).
- Server-driven alias sharing across teachers.
