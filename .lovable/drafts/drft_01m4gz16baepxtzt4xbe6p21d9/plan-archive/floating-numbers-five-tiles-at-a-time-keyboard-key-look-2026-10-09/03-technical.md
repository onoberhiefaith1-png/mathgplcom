## Technical details

- `src/components/smartboard/FloatingNumberPanel.tsx`:
  - Keep `WINDOW_SIZE = 5` and the existing `windowSlots` logic.
  - Replace the wrap-around `offset` arithmetic with a clamped linear offset in the range `0..max(0, remaining.length - visibleUnused)`. Base `canPrev` and `canNext` on the actual bounds, so the arrows grey out at the ends. The existing reveal-used behaviour is unchanged. The `reentryOffset` path stays only for the case where every number has been used.
  - Add a `tileStyle: "compact" | "premium"` prop, defaulting to compact. Move the chip button styling into one helper: compact keyboard key (28 px min, 1 px border, 2 px bottom edge, 4 px gap) and premium gold tile (40 px min). Leave `ChipLabel` font size untouched.
  - Swipe: pointerdown/up on the strip container with a 30 px horizontal threshold. When the threshold is passed, call `goBackward` or `goForward` and suppress the click that follows. Below the threshold, the tap goes through as normal. Drag and selection handlers are unchanged.
- `src/components/smartboard/PresentationView.tsx`: pass `tileStyle="premium"` when it is rendered with Game chrome (the Imagine and Game Pro players). Pass nothing elsewhere.
- Tests: add a vitest that pulls the clamped window maths into a small pure helper. It covers 3 items (3 visible, no padding), 8 items (5 visible), stepping to the end (right disabled) and the start (left disabled), and checks that every item is reachable. The existing `floatingDisplayVariants` test must still pass.
- Verify with typecheck, focused tests, and a Playwright run on desktop, tablet and phone for both the Smartboard and the Game.
