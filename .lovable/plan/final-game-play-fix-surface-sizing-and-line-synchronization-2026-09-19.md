# Final Game Play fix — surface sizing and line synchronization

The Game’s existing design, editor, materials, rewards, timers, and Floating Numbers interface remain unchanged. This work is limited to Play behavior.

## Confirmed current foundation

- Surface 0 already represents the read-only question, while solving begins at Line 1.
- Play already receives exact rendered text bounds from the 3D text renderer and stores those bounds per surface.
- The camera is fixed; the slate itself currently scrolls to bring a selected surface into view.
- Surface taps already reach the Game runtime, but line changes still pass through both the runtime and internal Floating Numbers state.
- Materials already use repeating texture maps, but some animated premium surfaces temporarily scale their bodies while dimensions settle.

## Build

### 1. One canonical active line

Make the Game runtime’s `activeLineId` the single authority for every solving line:

```text
activeLineId N
├── Writing Surface N
├── Floating Numbers Line N
├── Line Timer N
├── Vault N
└── Rewards N
```

Surface 0 remains outside this state. It displays the immutable question and cannot become a solving target.

### 2. One line-selection function

Route every navigation path through the same guarded `setActiveLine(N)` operation:

- tap Surface N → select N;
- Next → select current + 1;
- Previous → select current - 1;
- settled slate scrolling → select the centered solving surface.

The operation will update the runtime, Floating Numbers, selected surface, timer context, Vault context, and reward context together. Tapping the active surface will still focus the existing Floating Numbers input.

### 3. Correct indexing and writing ownership

Keep the mapping exact:

```text
Surface 0 = Question only
Surface 1 = Floating Numbers Line 1
Surface 2 = Floating Numbers Line 2
...
```

Text emitted by Floating Numbers Line N will only be written into Surface N. Line 0 never shifts the solving indexes.

### 4. Independent adaptive surfaces

Each surface will start from its own minimum dimensions and grow only from its own measured 3D content bounds plus horizontal and vertical padding. No longest-line calculation, shared width, inherited dimensions, or character-count sizing will be used.

- Short Surface 1 stays compact.
- Longer Surface 2 grows independently.
- Short Surface 3 returns to the minimum appropriate size.
- Empty surfaces begin at minimum size.
- Height changes continue to push later surfaces downward while preserving the configured gap.

### 5. Responsive 5% viewport boundaries

Calculate the available 3D width from the live Game viewport and fixed camera projection, then reserve 5% on each side:

```text
left boundary  = 5% of visible viewport
usable maximum = 90% of visible viewport
right boundary = 95% of visible viewport
```

Every surface may remain narrower when its own content is short, but none may cross these boundaries on desktop, laptop, tablet, or mobile. Long content wraps within the available width rather than widening the surface beyond it. No fixed pixel width will control this behavior.

### 6. Actual rendered-content measurement

Use the existing 3D text renderer’s content bounding box as the sizing authority for equations, fractions, roots, superscripts, subscripts, symbols, and teaching notes. Remove the character-count estimate from the Play sizing path; it may remain only as a temporary pre-measure fallback at the surface’s minimum size.

Instructional prose remains on one line when its measured width fits inside the available area, and wraps only when required.

### 7. Preserve physical materials during growth

Keep each saved surface as the same physical object and retain its exact Edit style. Resize/rebuild geometry around the measured bounds while maintaining texture repeat density, borders, ornaments, end pieces, and material identity. Avoid stretching wood, stone, parchment, metal, silk, cloud, crystal, royal, and magical treatments.

### 8. Keep the world fixed

Changing the active line will not move or replace the camera. Existing slate scrolling may position the selected physical surface inside the fixed world; only line state and surface focus change.

## Verification

Add focused regression coverage and verify the live Game at desktop and mobile widths:

1. A short saved Surface 1 retains its exact Edit style and compact size.
2. A longer Surface 2 grows independently inside the 5% boundaries.
3. Short Surface 3 does not inherit Surface 2’s width or height.
4. Tap Surface 4 → Surface 4 and Floating Numbers Line 4 are active.
5. Previous → Surface 3 and Floating Numbers Line 3 are active.
6. Next → Surface 4 and Floating Numbers Line 4 are active.
7. Tap Surface 7 → Surface 7 and Floating Numbers Line 7 are active.
8. Surface 0 remains the question and never shifts solving-line indexes.
9. Fractions, roots, superscripts, symbols, and teaching notes stay inside their own surfaces.
10. Growing one surface preserves the gap to all following surfaces and keeps saved material texture density believable.

## Not changing

No Game editor changes, visual redesign, new mathematics engine, replacement input panel, altered marking, altered reward rules, altered timer rules, or new configuration system.
