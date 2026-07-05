# Plan: placeholder blends with the smartboard background — everywhere else it stays full-strength

## Rule (final)

- **Floating Number generation page, Present preview, Floating Number display panel** → placeholder appears **exactly as it is today** — full-strength, clearly visible, default **black**. No faint styling. Nothing changes visually on these surfaces.
- **Smartboard writing surface** → placeholder is **still there** (structural slot, still tappable), but its color = the board's current background color. On a white board it reads white, on a black board black, on a yellow board yellow. Invisible to the eye, present to the layout and to the pointer.
- **Reactive to theme changes** → when the teacher switches the board background (white ↔ black ↔ yellow), placeholders on the board re-blend automatically. No code path to maintain, no re-render logic — the color is bound to the same CSS variable that drives the board background.

## Why this is safe (no rebuild)

The current placeholder cube in `RowView` (`src/components/smartboard/MathTreeRender.tsx`, empty sub-row branch) already works — it renders, it's tappable, it lays out correctly, structures behave. It's the color that's wrong on the board. So the surgical change is: **override only the color tokens on the board container**, leave the placeholder styling in `MathTreeRender.tsx` untouched. No rebuild of the empty-slot code, no risk of regressing the click/layout behavior you've stabilized.

## Implementation — one small, additive change

### 1. Confirm the board's background CSS variable
The smartboard root already exposes its background as a CSS custom property (`--sb-bg`, used by `FloatingMath.tsx` and other panels). I'll verify it is set on the outermost smartboard wrapper and reflects the live theme (white/black/yellow). If for any reason it isn't already reactive to the theme toggle, wire it there once — one style prop on the wrapper.

### 2. Scope a placeholder-color token to the board only
Add a single CSS variable **on the smartboard writing surface wrapper** (the element that hosts `FreeWriteLayer`):

```css
--placeholder-ink: var(--sb-bg);
```

This scoping matters: because the Floating Number panel, Present preview, and Floating Number generation page are rendered **outside** this wrapper, they never see `--placeholder-ink` — they keep the default (black), unchanged.

### 3. Point the placeholder styles at the token
In `RowView`'s existing empty-slot render, change **only** the three color-carrying properties to use the token with a black fallback:

- `border-color: var(--placeholder-ink, #000)`
- `background: var(--placeholder-ink, #000)` (currently transparent/tinted with caretColor — override with the token when idle so the cube fully blends; keep the active-focus glow driven by `caretColor` so a focused empty slot is still visible to the teacher)
- Any inner glyph color if present → `var(--placeholder-ink, #000)`

Everything else (dimensions, dashed style, radius, tap handler, caret, focus glow) stays. The fallback `#000` guarantees the panel/preview/generation-page render exactly as today.

### 4. Active-slot exception
When the sensor is actively parked in an empty slot on the board, the slot must still be visible so the teacher knows where the caret is. The current code already renders a focus glow using `caretColor`; keep that path exactly as-is so the *active* placeholder stays visible on the board. Only the **idle** placeholder blends with the background.

## Files touched
- `src/components/smartboard/MathTreeRender.tsx` — swap three hard-coded color references in the idle empty-slot render for `var(--placeholder-ink, #000)`. No structural change to the branch.
- The smartboard wrapper file that owns the board-color state (likely `SmartBoardPage.tsx` or the wrapper inside `PresentationView.tsx` that sets `--sb-bg`) — add `--placeholder-ink: var(--sb-bg)` alongside the existing background style. One line.

Nothing else edited. No delete-and-rebuild.

## Verification
1. Default black theme: build a fraction on the board — bar visible, top/bottom slots invisible (black on black), both still tappable, typing in each works.
2. Toggle board to white — the same fraction's empty slots turn white, still invisible, still tappable.
3. Toggle to yellow — slots turn yellow, still invisible.
4. Open Floating Number panel and Present preview — container chips (`□/□`, `√□`, `□²`) still render in default black, fully visible, unchanged.
5. Tap an empty slot on the board — it gains the focus glow so the teacher can see the caret; typing dismisses the slot as usual.
6. Rewind to an earlier line with a leftover empty slot — invisible on the board, still tappable if teacher returns to fill it.
