# Fix the junction crossing glitch (junction geometry only)

## What is actually wrong

Every hallway currently draws **one full-length floor slab at exactly y = 0 and one ceiling slab at exactly y = HALL_HEIGHT**, and each of those decks is deliberately padded roughly 3 m beyond the hallway's far end and back past its mouth (so the throat behind an opening isn't a dark void).

Where two corridors cross, those pads overlap: two identical, perfectly coplanar floor planes and two coplanar ceiling planes occupy the same depth. That is textbook z-fighting — the flicker/flash/see-through that appears only at the crossing and changes with camera angle. Nothing about walls, doors, lighting or the map is involved.

## The fix: segment the decks at the crossing, with real depth separation

No opacity tricks, no render-order or z-index band-aids, no global change.

1. **Solve the crossing box.** For each junction (branch mouth and connector-corridor meeting), compute the actual overlap footprint of the two corridors — the quadrilateral where their two decks share plan area. This reuses the existing junction/meeting solver rather than adding a second source of truth.

2. **Give each crossing a deterministic upper/lower corridor.** Priority is stable and data-driven (shallower hallway wins; ties broken by a fixed id comparison), so the same crossing always resolves the same way and never oscillates between frames.

3. **Cut the lower corridor's deck, don't hide it.** The floor and ceiling of a corridor become *runs* along their length (the same segmentation approach already used for wall runs), with the crossing footprint removed. Only the portion inside the crossing disappears; before and after the crossing the corridor's floor and ceiling stay continuous, edge-to-edge with the crossing slab.

4. **The upper corridor owns the crossing slab.** It carries one uninterrupted floor and ceiling straight through the crossing, with a small but real structural offset (a few millimetres of slab thickness, plus its own separate geometry) so its surfaces are never on the same plane as the lower corridor's cut edges. Together with step 3 there is simply no shared plane left to fight over.

5. **Stop pads from bleeding into a crossed corridor.** The deck pads (front pad, and the throat reach-back behind a mouth) get clamped so a deck never runs past the wall plane of a corridor it crosses. This removes the second source of overlap — a connector corridor's 3 m pad currently pushes right through the hallway it stops at.

6. **Keep the seams closed.** The existing junction throat triangles that carry floor and ceiling across the opening are re-anchored to the crossing slab's exact height, so the cut edges meet the slab flush — no visible gap, seam line or dark strip.

## What is deliberately untouched

Corridor design, wall runs, jambs, soffit, doors, ceiling lights, materials, textures, brightness, lighting, the Building Map, navigation, walking, camera behaviour and every surrounding surface stay exactly as they are. Only deck segmentation and crossing depth change.

## Technical notes

- New geometry helpers live in `src/lib/building/navigation.ts` next to `junctionGeometry` / `wallRuns` / `connectorMeeting`: a crossing-footprint solver and a deck-run splitter (the 1D analogue of `wallRuns`, applied to floor/ceiling spans).
- `SegmentCorridor` in `src/components/academy/world/HallwayScene.tsx` stops rendering a single floor/ceiling plane and instead maps over solved deck runs; the crossing slab is rendered by the priority corridor. Surface textures keep their current per-run fitting so appearance and brightness do not change.
- Deck pads (`frontPad`, `deckBack`) become clamped values derived from the crossing solver instead of fixed constants.
- Verification: Playwright walk-through of the sample maze, screenshots taken from four angles at each crossing (approaching, standing in it, past it, and from the crossed corridor) plus a two-frame comparison at each angle to prove no flicker; console checked clean.
