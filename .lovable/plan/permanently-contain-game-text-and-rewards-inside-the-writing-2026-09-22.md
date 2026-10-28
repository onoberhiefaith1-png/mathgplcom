# Permanently contain Game text and rewards inside the writing band

## Goal

Make the existing invisible horizontal Game layout the single source of truth for everything attached to a line:

- its physical writing surface;
- all visible text modes;
- the invisible text layout and click area;
- its rewards and effects.

Nothing may exist behind the left 5% margin or beyond the right 95% margin. In rooms, the same band must become narrower where walls, pillars, or frames obstruct it.

## Confirmed causes

- The physical surfaces and text currently calculate from the responsive, room-safe writing width.
- Rewards still calculate their horizontal position from the old fixed slate width, so they do not share the surface boundary.
- The surface-box helper still contains an editable-mode branch that can return a width unrelated to the physical surface. Although the current caller works around it, this is a loophole that can reintroduce escaped text later.
- Text measurement feeds surface growth correctly, but the boundary is represented as separate width/position calculations rather than one reusable layout object.
- A separate Smartboard keyboard path currently triggers a maximum-update-depth error while entering text. That loop can interrupt the same writing experience and must be stabilized without changing the mathematics.

## Build

### 1. Create one canonical writing-band layout

Calculate one immutable layout result at the surface depth:

```text
visible viewport
  → remove 5% left and 5% right
  → restrict to the clear opening between room obstructions
  → canonical left edge, right edge, centre, and width
```

Use this exact result in Edit and Play. No surface, text renderer, hit target, reward, or effect may calculate its own competing horizontal frame.

### 2. Make each surface and its text one bounded unit

For every line:

- anchor the surface at the canonical left edge;
- grow the surface and text together from their own content;
- reserve the material padding inside the surface before assigning text width;
- stop both at the canonical right edge;
- wrap long equations and notes inside the same surface;
- grow that surface downward from the wrapped height;
- move following surfaces down while preserving their existing gaps;
- apply the same rule to Surface Test, 3D Test, dimensional text, and tile text;
- keep the inactive renderer mounted but invisible, as required.

Remove the editable/read-only sizing divergence so no future caller can bypass the safe box.

### 3. Cut the invisible interaction layer at the same margins

Make the transparent writing/click plane exactly match the inner writing box. It must not extend behind the 5% margins or room obstructions. Surface 0 remains read-only; Surface N continues to select Floating Numbers Line N.

### 4. Put rewards inside the same line-local band

Convert each saved reward percentage through the canonical writing-band width, not the legacy fixed slate width. Keep rewards attached to their existing line and preserve their saved percentage positions, activation rules, artwork, and behavior.

Clamp reward bodies, drag targets, collector reach, and visual-effect origins so their visible bounds remain inside the band rather than merely keeping their centre inside it.

### 5. Stabilize the writing update path

Remove nested state updates from the active-line text mutation callback that can produce the current maximum-update-depth failure. Preserve the live cursor, selected line, Floating Numbers input, proactive marking, and locked-ink protections, but commit each key action through one bounded update cycle.

## Verification

1. Test at wide desktop, tablet, and mobile sizes: the leftmost and rightmost visible content remain inside 5% and 95%.
2. Repeat in every room family: text, surfaces, rewards, and effects stay inside the visible architectural opening.
3. Test short, long, multiline, unbroken, dimensional, and tile text; the matching surface grows and then wraps with no escaped glyphs.
4. Test left, centre, and right teacher alignment; every glyph remains inside its own surface.
5. Confirm notes remain hidden until the authoritative full mark and then wrap inside that awarded line’s surface.
6. Confirm incorrect and incomplete lines activate no note or completion reward.
7. Drag rewards to both extremes in Edit; their full visual body remains inside the band, and Play matches Edit.
8. Rapidly enter Floating Numbers on Lines 1–3; text appears in the matching surface without update-loop errors or line reversal.
9. Scroll from Surface 0 to the final surface; gaps remain clear and all content is reachable.
10. Run focused layout, renderer, line/reward, and input regression tests plus the full type check.

## Not changing

No Slate Artisan redesign, second renderer, second mathematics engine, grading change, Vault behavior change, reward-rule change, room/camera redesign, or teacher-style replacement.
