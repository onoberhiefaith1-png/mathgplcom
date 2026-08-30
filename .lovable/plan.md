# Floating Number Display — Selectable Design System

The floating-number engine stays exactly as it is. Nothing about extraction, chip validation, the five-slot conveyor, used/unused zones, line navigation, notebook checkpoints or table chips changes. We wrap the existing display in a variant layer so the same live data can be drawn in ten different layouts.

## What the teacher sees

Smartboard Settings gains a new section: **Floating Number Display** — "Choose how floating numbers appear on the Smartboard."

It shows ten cards. Each card has a real miniature preview of that layout (not a text name), the design name, a one-line description, a **Use this design** button, and badges: `✓ Your design` and `✓ Platform default`.

Administrators additionally get **Set as platform default** on each card. That choice is saved platform-wide and is what everyone sees until they pick their own. A personal choice always wins for that person; someone who has never chosen follows the current platform default automatically, including when the administrator changes it later.

## The ten designs

1. **Original** — today's layout, byte-for-byte unchanged (default until an administrator changes it).
2. **Split Triangle Vertical** — up/down triangles split around the line badge, left of the bar.
3. **Top & Bottom Full-Width** — full-width filled up/down bars above and below the rectangle, line badge to the left.
4. **3D Cube** — raised cube: top face = up, bottom face = down, front face = the number bar, left face = line indicator.
5. **Rounded Vertical Control** — one tall rounded pill holding up ▲, the L-badge circle, and down ▼.
6. **Top/Bottom Bars + Side Label** — coloured accent bars with the line label as a separate side chip.
7. **Minimal Outline** — outlined, low-ink, large outline triangles.
8. **Diamond Indicator** — diamond line badge with big triangles above and below it.
9. **Glass** — translucent blurred controls over the board.
10. **Neon Accent** — high-contrast dark bar with bright triangles for classroom-distance visibility.

Every design keeps, without exception: a rectangular number area, left and right navigation, up and down navigation, and the L1/L2/L3 line indicator. Only shape, colour and position change.

## Touch rules applied to all variants

- Left/right stay attached to the number rectangle and are drawn as real filled triangles, minimum 56 px hit area — never a small "<" glyph.
- Up/down are filled triangles with a minimum 56 px hit area and clear separation from the chips so a mis-tap cannot fire them.
- The line indicator stays legible from the back of a classroom (min 15 px bold, tabular digits).
- Disabled states dim but keep their footprint, so nothing shifts as the teacher navigates.

## Technical notes

- `src/lib/smartboard/floatingDisplayStyles.ts` — new: `FloatingDisplayStyleId` union of the ten ids, the catalogue (id, name, description), `DEFAULT_FLOATING_STYLE = "original"`, and a sanitiser so an unknown stored id falls back safely.
- `src/components/smartboard/FloatingNumberPanel.tsx` — no logic touched. All state, memos, `goBackward`/`goForward`, `handleActiveTap`/`handleUsedTap`, `windowSlots`, `lineNoOf`, notebook icon and table chip stay. Its render is refactored to compute three presentation-agnostic pieces — `chips` (already-built chip nodes), `nav` handlers/enabled flags, `lineBadge` data, `extras` (notebook + grip) — and hand them to `<FloatingDisplayFrame style={styleId} …/>`. `original` renders the exact current markup, so Design 1 is a literal reuse, not a re-implementation.
- `src/components/smartboard/floatingDisplays/` — new folder: `types.ts` (the frame contract), `index.tsx` (style → frame map), one small file per variant, plus `NavTriangle.tsx` and `LineBadge.tsx` shared primitives (filled SVG triangles, large hit boxes).
- `src/components/smartboard/SettingsSheet.tsx` — new "Floating Number Display" section rendering the gallery via a new `FloatingDisplayGallery.tsx`, which draws each frame at small scale with static fake chips (`½`, `x =`, `or`, `−3`) so previews never touch live reservoir data.
- Persistence: one migration adding `public.floating_display_settings` — a single-row platform table (`id boolean primary key default true`, `style text`) readable by `anon`/`authenticated`, writable only through `has_role(auth.uid(),'platform_owner'|'co_admin')`; and `public.user_display_preferences` (`user_id uuid primary key references auth.users`, `floating_display_style text`) with owner-only RLS. Both get explicit GRANTs.
- `src/lib/smartboard/floatingDisplay.functions.ts` + `.server.ts` — `getFloatingDisplayStyle` (returns `{ platformDefault, userChoice }`), `setMyFloatingDisplayStyle`, `setPlatformFloatingDisplayStyle` (admin-checked). A `useFloatingDisplayStyle()` hook resolves `userChoice ?? platformDefault ?? "original"`, caches in `localStorage` for instant first paint, and is read by `PresentationView` (both panel call sites) and the student board.
- Verification: typecheck, existing smartboard/floating tests, and a Playwright pass rendering each variant to confirm all five controls are present and hit areas meet the minimum.
