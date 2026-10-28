# Writing-Surface Text: Real Persistence + Restore

## What I found (the actual cause)

A text on the game writing surface has **no saved position or size of its own**. Each line stores only its words. Where the words appear is recalculated from scratch every time the game opens, from the room/surface measurements of that moment, plus a live "push it back in" correction that only runs *after* the first measurement of the letters arrives.

That produces exactly the reported behaviour:

- On reopening, the first frames draw the words at an uncorrected place. If the measurement is late, or the surface measures differently (different phone/tablet/desktop size, different room, longer text), the words land outside the panel.
- The correction is temporary, never saved, so every reopen re-rolls the dice.
- The mathematics layer draws through a screen-level overlay whose letter size ignores the teacher's saved per-device size, so its box can be larger than the panel it must sit in — the "positioned relative to the screen" symptom.

So this is fixed at the architecture level, not by nudging the text.

## What will be built

### 1. The writing surface becomes the coordinate system
Every text gets a saved configuration expressed **as a share of its own writing surface** (for example "start 6% in from the left edge, 20% down from the top"), never in screen or page coordinates. Because it is a share of the surface, it stays correct on any screen, any device, any window size.

### 2. Save stores the master configuration
When the teacher saves the game, each line's text keeps its own permanent record: the words, place on the surface, width, height, letter size for phone/tablet/desktop, font, weight, alignment, rotation, colour and spacing. That record is the master configuration.

### 3. Placement is read from the saved record, not recalculated
On opening, teacher play and student play, the text is placed directly from the saved record, before anything is measured — so there is no moment where it can appear in the wrong place. The old live correction stays only as a final guard, and can never override the saved record.

### 4. Restore icon
A small Restore icon is added at the top of the writing-surface interface, **visible to the teacher only**. One click puts **every text on the surface** back to its saved master configuration: same words, same place, same size, same formatting, inside the panel. It never creates a second text and never asks the teacher to redo anything.

### 5. Same for everyone
The saved record travels with the game, so a student opening it, a refresh, a reopen, or another teacher viewing it all see the identical configuration.

## Technical detail

- `Slot` (`src/lib/slate/types.ts`) gains an optional `textConfig`: surface-relative anchor (`ax`, `ay` as fractions of the inner writing box), `widthFrac`/`heightFrac`, `desktopSize`/`tabletSize`/`mobileSize`, `align`, `rotation`, plus the presentational fields currently only global in `game.settings.text`. Optional, so existing saved games keep working.
- `normalizeGame` (`src/lib/slate/storage.ts`) backfills a default `textConfig` derived from the current layout maths + `game.settings.text`, so legacy games gain a master configuration on first load without losing teacher work.
- `WritingRegion.tsx`: the render group's origin comes from `textConfig` resolved against the authoritative `writingSurfaceFrame`/`surfaceInnerBox`, not from the accumulated `shift` state. `shift` is demoted to a clamp-only guard applied after `containTextInSurface`, and never persists across reloads.
- `StructuredMathText.tsx`: the HTML layer's `fontSize` uses `responsiveTextSize(settings, viewport)` and is clamped so its measured box fits `innerWritingWidth`/`surfaceHeight`; the `Math.min(72, settings.size)` hardcode goes.
- Restore action: a `restoreTextToSaved()` helper in `src/lib/slate/lineSurfaces.ts` (or a sibling) that rewrites every slot's live text object from its saved `textConfig`; wired to a new icon button in the writing-surface header, gated on the teacher/editable role. No new object is created — the existing slot is mutated in place.
- Persistence path is the existing `games` row (`slots` JSON) — no migration needed.
- Tests extend `src/lib/slate/__tests__/layout.test.ts` and `textInSurface.test.ts`: save → reload round-trip keeps the anchor; a deliberately corrupted placement is fully recovered by restore; the three device sizes each resolve inside the surface.

## Out of scope
Grading, Vault matching, rewards, sounds, rooms, camera, Floating Numbers mathematics and the Smartboard tree are untouched.
