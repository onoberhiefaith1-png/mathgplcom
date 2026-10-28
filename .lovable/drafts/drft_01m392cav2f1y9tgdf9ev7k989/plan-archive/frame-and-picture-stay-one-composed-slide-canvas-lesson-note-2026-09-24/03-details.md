## Technical detail

- **Persistence:** keep the staged `zoom` column migration and add `cover boolean default false` in a second additive migration on `notebook_slide_items`. `slides.ts` adds `cover` to `ITEM_COLS` and keeps the legacy fallback.
- **SlideCanvas.tsx (minimal touch):** when the item's zoomed rect covers `[0,1]×[0,1]` within ~0.5%, snap `x,y,w,h,zoom` so the item covers the frame exactly and set `cover=true`. Moving or shrinking the item away from the edges clears it. Pending writes are debounced in a queue.
- **SlidePanel.tsx:** new Save button that flushes the queue with `updateSlideItem` for every changed item, then shows a Saved/Error state.
- **SlideStage/SlideMedia:** a `cover` item renders as `absolute inset-0` with `object-cover` (aspect ratio preserved, no rounding gaps). Other items keep their saved rect and zoom unchanged.
- **CanvasSlideViewer.tsx:** remove the `px-11` inset. Chevrons overlay the slide edges inside the fixed control layer. The stage scale is measured from the full host width, so the frame ratio is identical in note and board.
- **Acceptance (after the draft is accepted):** Test 1 Canvas fill → Smartboard fill with no white strips. Test 2 note 100→200→300%: stays landscape and text moves down. Test 3 board enlarge plus bounded drag. Evidence comes from Playwright screenshots on the "ki" deck.
