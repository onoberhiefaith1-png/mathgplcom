# Plan: reconnect Text Settings to the real Game text

## Goal

Keep the new surface-boundary protection exactly as it is, then fix the remaining issue: every Text Setting must visibly control the rendered Game text in Edit, Preview, Play, Test, after save/reopen, and after resize.

The intended flow is:

```text
Text Settings → saved/current text state → one resolved style → renderer → measured visible bounds → surface layout/fit
```

## What I confirmed in the current code

- The control panel already exposes the relevant Text Settings: responsive size, writing style, preset, animation, depth, bevel, front colour, depth colour, shadow, highlight, glow, alignment, line spacing and letter spacing.
- The boundary fix is now centred in `resolveSurfaceTextPlacement` and `WritingRegion`, which keeps text inside its owning writing surface.
- The renderers receive `TextSettings`, but some displayed layers still use stale/default behaviour:
  - plain and structured fallback layers cap or simplify size/shadow/depth behaviour;
  - per-slot saved `textConfig` currently carries only size, colour, alignment and spacing, not the full appearance settings;
  - surface re-measure keys focus on size/alignment/spacing and do not account for depth, shadow, preset, glow or animation bounds;
  - visible bounds are based mainly on the flat text box plus a fixed relief estimate, not the full rendered object including extrusion and shadow.

## Non-negotiables

- Do not redesign the Game UI.
- Do not remove any existing Text Settings.
- Do not break the current rule that text stays inside its writing surface.
- Do not “fix” this by freezing text size or ignoring large settings.
- Preserve existing Game behaviour, rewards, maths, saved teacher designs, Preview and Play matching.
