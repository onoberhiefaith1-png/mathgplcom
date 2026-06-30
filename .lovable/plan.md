# Smartboard Layout Terminology + Text Size Engine

Rename the spacing concept across the codebase and lock down what Text Size, Row Spacing, and Zoom each control. Today the slider is called "Lesson Line Spacing" but it actually moves physical rows, which contradicts the agreed definition of a Lesson Line as one complete teaching step.

## 1. Terminology lock

Adopt four terms with one meaning each:

- **Section** — major block (Title, Introduction, Example, Solution, Summary). Fixed container.
- **Lesson Line** — one complete teaching step (e.g. `a = 1`, or `x = (-b ± √(b²−4ac)) / 2a`). May span multiple rows.
- **Row** — invisible horizontal writing guide; layout position only.
- **Row Spacing** — vertical distance between consecutive rows.

All UI copy, code comments, variable names, and storage keys are aligned to this.

## 2. Rename the slider: Lesson Line Spacing → Row Spacing

UI:
- `SettingsSheet.tsx` section header: "Lesson Line Spacing" → "Row Spacing", helper text rewritten ("0% packs rows tightly together; higher values push rows further apart. Never affects the inside of a fraction, root, or matrix.").

Code:
- `src/lib/smartboard/grid.ts`: rename `clampLineSpacing` → `clampRowSpacing`, parameter `lineSpacing` → `rowSpacing`, internal constants `MIN_ROW_PER_FONT`/`MAX_EXTRA_GAP` stay as-is (they already describe rows).
- `PresentationView.tsx` and any other consumers: rename `lineSpacing` state and props to `rowSpacing`.
- `localStorage` key `smartboard:lineSpacingV2` → `smartboard:rowSpacingV1`. One-time migration: on mount, if the new key is absent and the old key exists, copy the value over, then ignore the old key.

No behavioural change to the slider math — only naming and copy. The slider already governs row gap, never internal math structure.

## 3. Enforce: Row Spacing never enters a Lesson Line

Audit the layout pipeline to confirm Row Spacing only adds gap *between* rows that belong to different Lesson Lines, never between rows of the same Lesson Line (tall fractions, roots, matrices, integrals).

- In `presentation.ts` / `lessonLines.ts`, every Lesson Line already carries a `rowSpan`. The render pass must place internal rows at the natural row pitch (`MIN_ROW_PER_FONT * FONT_PX`) with **zero extra gap**, and apply the Row Spacing extra gap only at the boundary between Lesson Line N and Lesson Line N+1.
- Add a small helper `lineToYWithinLesson(lessonIdx, rowOffset)` so multi-row structures use the intrinsic pitch; the existing `lineToY` continues to govern Lesson-Line-to-Lesson-Line transitions.
- Vitest: `rowSpacing.test.ts` — at 0% and 100% Row Spacing, the *internal* row gap of a tall fraction is identical; only the gap to the next Lesson Line changes.

## 4. Text Size becomes an engine rule

Specify Text Size as: scales every Lesson Object; layout reflows automatically; nothing else changes.

Lesson Objects that scale:
- Plain prose text, equations, fractions, roots, matrices, integrals, superscripts/subscripts
- Graph labels, diagram labels
- Floating Numbers chips
- Lesson Notes

Untouched by Text Size:
- Page width, page margins, toolbar, Section headers/positions
- Row Spacing slider value
- Section gap constants
- Zoom level

Engine pipeline on every Text Size change:
1. Recompute `FONT_PX = BASE_FONT_PX * zoom * textScale` (already in `grid.ts`).
2. For every Lesson Line, recompute its intrinsic height as `rowSpan(textScale) * naturalRowPitch(textScale)`. `rowSpan` itself may grow because a fraction that fit in 2 rows at 100% may need 3 rows at 160%.
3. Reflow: Lesson Line N+1's first row = Lesson Line N's last row + Row Spacing extra gap.
4. Repaint floating-number strips, sensor, and notes using the new Lesson Line bounds.
5. Persist `textScale` to `localStorage`; Row Spacing value is untouched.

Components that need a Text Size pass review (apply `FONT_PX` consistently, no hardcoded font-size):
- `MathTreeRender.tsx` (fractions, roots, matrices grow proportionally — overline auto-stretches, brackets auto-stretch, superscripts proportional)
- `FreeWriteLayer.tsx` (prose lines)
- `FloatingNumberPanel.tsx` (chip font + chip height)
- `BeatBlock` / Section headers in `PresentationView.tsx` (Section headers themselves do NOT scale — they belong to chrome; confirm this is the desired behavior and keep them fixed).

Decision needed: should Section headers ("Solution", "Example 2") scale with Text Size? Spec says "Sections do not move", which I'm reading as "Section header position/style is layout chrome and stays fixed". Confirmed below.

## 5. Zoom stays orthogonal

Zoom only changes how large the whole page appears on screen — it multiplies everything (rows, text, chrome) uniformly via the existing `zoom` parameter in `getGrid`. It must not touch:
- Row Spacing value
- Text Size value
- Section gap constants

No code change expected here; just verify no consumer reads `zoom` as a proxy for Text Size.

## 6. Files touched

- `src/lib/smartboard/grid.ts` — rename param, keep math.
- `src/components/smartboard/SettingsSheet.tsx` — rename slider, rewrite helper text.
- `src/components/smartboard/PresentationView.tsx` — rename state/prop, migrate `localStorage` key, ensure Row Spacing extra gap is applied only at Lesson Line boundaries.
- `src/lib/smartboard/lessonLines.ts` / `presentation.ts` — expose Lesson Line boundaries to the layout pass.
- `src/components/smartboard/MathTreeRender.tsx`, `FreeWriteLayer.tsx`, `FloatingNumberPanel.tsx` — confirm all sizing flows from `FONT_PX`; remove any hardcoded font sizes that would skip Text Size.
- New tests: `src/test/rowSpacing.test.ts`, `src/test/textSize.test.ts`.

## 7. Acceptance checks

1. Settings panel shows "Row Spacing" and "Text Size" — no "Line Spacing" anywhere.
2. Moving Row Spacing 0% → 100% changes the gap between `a = 1` and `b = 5`, but does NOT add any gap between the numerator and denominator of a fraction on a single Lesson Line.
3. Moving Text Size 100% → 160% grows every equation, fraction, root, matrix, floating-number chip, and prose line. The page width, margins, Section headers, and Row Spacing setting are unchanged.
4. When a fraction grows enough that it now needs an extra row, the next Lesson Line moves down automatically and never overlaps.
5. Reload preserves the user's Row Spacing and Text Size; the old `smartboard:lineSpacingV2` value migrates once.

## Out of scope

- No changes to AI generation or floating-number logic.
- No changes to zoom behavior beyond verifying orthogonality.
- No DB schema changes.

## Open question for you

Should the Section headers ("Solution", "Example 2") also grow with Text Size, or stay fixed as part of the chrome? My current reading of your spec is **stay fixed**, but tell me if you want them to scale too.
