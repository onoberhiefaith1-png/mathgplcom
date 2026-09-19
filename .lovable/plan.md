# Game Play — Surface 0, direct line selection, and correct writing layout

## The requested corrections, one by one

1. **The first writing surface is Surface 0.** It displays the question (for example, `x + 7 = 12`), remains read-only, carries no solving rewards, and is not a Floating Numbers working line.
2. **Surface 1 maps to Floating Numbers Line 1, Surface 2 to Line 2, and so on.** The surface number, line ID, timer, rewards, completion state, and written mathematics remain one-to-one.
3. **Clicking a solving surface activates that exact Floating Numbers line.** Clicking Surface 7 moves the Floating Numbers display and sensor to Line 7 immediately, ready for input. The existing previous/next arrows remain available but are optional.
4. **Surface 0 never activates an editable Floating Numbers line.** It only shows the immutable question.
5. **The teaching note appears below the student's mathematical working.** For the marked example, `x + 7 = 12` appears first and `subtract 7 from both sides` appears beneath it after the note is activated/revealed; it must never be placed above the equation.
6. **All text remains inside its own writing surface.** Long prose wraps before the right edge instead of extending beyond the material.
7. **Each writing surface expands vertically with its own content.** When Surface 2 becomes taller, Surface 3 and every following surface move down while preserving a constant visible gap. Surfaces and their text must never merge or overlap.
8. **Writing uses the full horizontal area instead of being centred in a narrow block.** The writing region starts at 5% from the left and ends at 95% on the right, giving a stable 90% writable width. Text begins at the left margin and wraps only when it reaches the right margin.

## Confirmed current behavior to correct

- The Game already creates a question row numbered `0`, followed by solving rows `1..N`.
- Surface clicks already report their slot ID, but the Play bridge currently treats selection and scrolling differently: scrolling excludes Surface 0, while a direct click can still send `0` into the solving-line selector.
- The Floating Numbers panel already follows the Game's active solving line, so the correction will keep one authoritative active line rather than add another navigation system.
- Play currently combines each completed line as **note first, working second**, which explains the reversed order in the screenshot.
- The 3D renderer supports wrapping, but the physical surface width currently follows measured text width while the writing region uses a different width. This allows text to appear outside the visible slab.
- The column already measures rendered text to grow rows, but its placement must use the final surface bounds and guaranteed inter-surface spacing so a growing row cannot collide with the next one.

## Build

### 1. Lock the line-number contract

Use one explicit mapping throughout Game Play:

```text
Surface 0 = immutable question
Surface N = Floating Numbers Line N, for N >= 1
```

Keep Surface 0 outside line timers, line completion, rewards, and student input. Clamp restored and reset solving progress to Line 1 without changing the visible question surface.

### 2. Make every solving surface a direct line control

Route both surface clicks and settled scrolling through one guarded selection function. It will accept only solving surfaces (`N >= 1`), update the Game's active line, and drive the existing controlled Floating Numbers line index. Clicking the already-active surface will still focus the Floating Numbers input so the student can type immediately.

### 3. Correct the content sequence

Build each solving surface's display as:

```text
student mathematical working
revealed teaching note
```

Preserve the existing rule that the note is revealed only when its line earns completion. The question stays alone on Surface 0.

### 4. Give every surface a stable 90% writing band

For Game writing surfaces, use matching physical-surface and text-layout widths with 5% left and right margins. Force live Game mathematics and notes to left alignment inside that band while preserving the teacher's saved font, 3D preset, colours, depth, effects, material, and rewards.

Use the same width for Troika wrapping, measurement, the transparent hit area, and the visible surface so no renderer can calculate a wider line than the slab beneath it.

### 5. Preserve vertical separation during growth

Calculate every row from its measured wrapped-text bounds plus top/bottom padding. Position the next row from the previous row's final bottom edge plus a fixed gap, not from text-centre estimates. Keep the gap stable before measurement, after wrapping, and when notes appear. Avoid shifting text independently from its surface.

### 6. Focused regression coverage

Add checks for:

- row sequence `0, 1, 2, ...` and no rewards/input on row 0;
- Surface 7 selecting Floating Numbers Line 7 and refocusing its input;
- Surface 0 leaving the active solving line unchanged;
- working rendered before its revealed note;
- long note text wrapping within the 5%–95% band;
- a growing Surface 2 pushing Surface 3 down while preserving the configured gap;
- selection by click, scroll, and arrows always resolving to the same active line.

## Browser verification

Use the marked equation in Game Play:

1. Confirm the first visible slab is numbered **0** and contains only `x + 7 = 12`.
2. Click Surface 1, type through Floating Numbers, then click Surface 7 and confirm the panel/sensor immediately shows Line 7.
3. Reveal `subtract 7 from both sides` and confirm it appears below the working, wraps inside the surface, and starts at the left 5% margin.
4. Confirm Surface 2 grows downward and Surface 3 moves with it without overlap.
5. Repeat at desktop and mobile widths with the previous/next arrows as a secondary navigation option.

## Not changing

No new mathematics engine, input panel, note generator, timer rules, reward rules, or Game configuration system. The existing Mobile Floating Numbers interface remains the only student input, and the saved Game continues to own its visual materials and effects.
