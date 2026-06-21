## Goal
Make manual Highlight → Enter on the Floating Workspace page:
1. Always accept the teacher's selection as a floating chip (no silent rejection).
2. Preserve the on-board math structure of what was highlighted — especially stacked fractions like u/x, radicals, powers, and bracketed function calls.

## Problem today
- When the teacher highlights the stacked fraction u over x, `window.getSelection().toString()` returns the flat string "ux" (KaTeX renders numerator above denominator, with no slash between them). Our `recoverFraction` helper only matches when the variant equals `num+den` or `num/den` exactly; in practice it often misses because of stray characters, spacing, or because `line.equation` no longer holds the `\frac{...}{...}` source. The new chip ends up as plain "ux" / "u·x" and the stacked structure is lost.
- When the teacher highlights f(x) and presses Enter, the chip sometimes does nothing. Today `commitHighlightAsChip` calls `computePayload`, and if `isStillDirty` flags the cleaned string the commit is silently rejected with a destructive toast. We need Enter to be unconditional.

## What changes

### 1. Trust the highlight — Enter never refuses
- Treat the teacher's selection as authoritative. If structure recovery succeeds we use the recovered markup; otherwise we fall back to the literal selection text. We never throw the chip away.
- Remove the "Could not add chip / invalid math" rejection path. The worst case is a plain-text chip — that is still what the teacher highlighted.
- Keep the existing override behaviour: any existing filler that is a sub/superstring of the new chip is replaced, so the teacher's manual chip wins over scattered or oversized AI chips.

### 2. Structure-aware selection capture
Replace today's "match `\frac{a}{b}` substrings in the raw equation" approach with a DOM-walk that reads the actual rendered KaTeX nodes inside the selection range.

For the selected range we walk the common ancestor and rebuild source markup:
- A `.mfrac` (or KaTeX fraction wrapper) inside the selection → emit `\frac{<numerator text>}{<denominator text>}`. Numerator and denominator come from the corresponding KaTeX subtrees, not from `toString()`.
- A KaTeX superscript (`.msupsub`, `.vlist` with sup) → emit `<base>^{<exp>}`.
- A KaTeX radical (`.sqrt`) → emit `\sqrt{<radicand>}`.
- A KaTeX `\left( … \right)` group → keep the parentheses paired; never return half a bracket.
- Plain atoms (digits, letters, operators) → emit their text content.

This gives us a "source-shaped" string for the selection regardless of whether `line.equation` still has the original `\frac` markup.

### 3. Container inference from recovered structure
After the source-shaped string is built we look at what it contains and add the matching container to the line if it is not already present:
- contains `\frac{…}{…}` → add `fraction`
- contains `\sqrt{…}` or `√` → add `radical`
- contains `^{…}` → add `power`
- contains paired `(…)` after a name/atom → add `bracket`
This reuses the existing `ContainerKind` set; no schema changes.

### 4. Promoter fallback only when no structure was recovered
If the DOM walk produced a plain atom (e.g. the teacher highlighted just `2` in `2^{x+5}`), we still run `promoteSelection` on the plain text so the existing "attach empty exponent shell when ^ follows" / log / trig / bracket rules keep working. Structure recovered from the DOM always takes priority over heuristic promotion.

### 5. Tests
Add unit tests for the new DOM-to-source helper using JSDOM fixtures that mimic KaTeX output:
- stacked fraction u over x → `\frac{u}{x}` with `fraction` container
- `\sqrt{x+1}` selection → `\sqrt{x+1}` with `radical` container
- base of `2^{x+5}` selected alone → plain "2" + `promoteSelection` attaches `^{□}` and `power` container
- whole `f(x)` selected → chip is exactly `f(x)`, no rejection, Enter always commits
- selection of one bracket only → expanded to the paired `(…)`, never half a bracket

## Files to change
- `src/components/lessonnotes/FloatingWorkspace.tsx` — replace `recoverFraction` + `computePayload` with a `recoverSelectionSource(range)` DOM walker; remove the destructive "Could not add chip" rejection; keep override + glow logic.
- `src/lib/smartboard/manualFloatingPromoter.ts` — small tweak so when the caller already passes structured markup (containing `\frac`, `\sqrt`, `^{`) it returns it untouched plus the inferred container.
- `src/test/manualFloatingPromoter.test.ts` — add the cases listed above (DOM cases use a tiny KaTeX-shaped fixture).

## Out of scope
- No change to the AI Generate path, the highlight-preparation page, or any backend code.
- No new container kinds; we only attach kinds already supported by the workspace.
