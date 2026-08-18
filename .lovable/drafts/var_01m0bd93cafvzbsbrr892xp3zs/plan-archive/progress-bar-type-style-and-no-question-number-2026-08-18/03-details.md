## 3. Style list follows the type

- Segmented → the 10 existing painted tower frames (unchanged, including the "use uploaded image" option).
- Liquid Fill → the 5 existing crystal vessels.
- Only one family is ever visible at a time; the chosen style is what renders.

Settings that only make sense for the tower (slot count, per-slot energy effects, effect size, fill style) are hidden while Liquid Fill is selected. Marks, class goal and question linking stay visible for both.

## 4. Rendering

The canvas element that draws a progress bar picks its renderer from the type: liquid → crystal vessel sized to the element's box, segmented → the tower as today. Both are driven by the same existing `currentMarks / totalMarks` value, so editor preview, presentation and live gameplay all fill from the real marks with no new calculation.

## Technical notes

- `src/lib/games/types.ts`: add `barType?: "liquid" | "segmented"` and `liquidStyleId?: string` to `ProgressConfig`, plus `barTypeOf(progress)` defaulting to `"segmented"`. `progressFill` untouched.
- `src/components/assets/QuestionProgressContainer.tsx`: remove the `questionNumber` prop and its plate.
- New `src/lib/games/liquidStyles.ts`: the 5 vessel themes as a selectable style list (id, name, theme) so settings and renderer share one source.
- `src/components/gamebuilder/SettingsPanel.tsx`: type selector, then a type-scoped style grid; conditionally hide tower-only controls.
- `src/components/gamebuilder/CanvasElementView.tsx`: branch to the liquid renderer when the type is liquid.
- `src/pages/Assets.tsx`, `src/pages/QuestionProgressContainerEditor.tsx`: drop the removed prop.
- No database or migration changes; the new fields ride inside the existing canvas JSON.

## Verification

Open an adventure progress bar's settings: switch type to Liquid Fill, pick a vessel, confirm no `Q` label anywhere and that raising marks in the preview lifts the liquid and updates `x/100`. Switch back to Segmented and confirm the existing tower and slot behaviour are unchanged, and that an untouched older adventure still renders its tower exactly as before.
