# Fix "Page" mode in the tutorial viewer

## What's wrong

When the tutorial is open, the tutorial layer wraps the real page in a two-panel
layout. Choosing **Video** collapses that layout to one panel, but choosing
**Page** does not: the page is squeezed into the left panel while the right panel
stays on screen as an empty coloured block — the "yellow screen" you see. The
page underneath was never replaced; it was just shrunk next to an empty panel.

## The fix

In the tutorial layer, treat **Page** the same way **Video** is already treated:
collapse to a single full-size panel, this time showing the real page.

- Page mode: the live page fills the whole screen; no second panel, no divider,
  no forced full-height/overflow wrapper — the page keeps its own layout and
  scrolling.
- Video mode: unchanged.
- Split view: unchanged.
- The video element stays mounted and parked off-screen in Page mode, so
  playback and position continue, exactly as it does today.
- Nothing about the page is unmounted or re-created when switching between the
  three modes, so scroll position, selections and in-progress work are kept.

## Technical detail

`src/components/guides/PageGuideProvider.tsx` builds its split grid inline and
only has a collapse case for `view === "video"`. Add the equivalent collapse for
`view === "board"` (single column/row, and skip the `h-screen`
/`overflow-hidden`/`bg-border` split wrapper), matching the behaviour already
implemented in `src/components/common/SplitCompanionFrame.tsx`. The existing
parked-player branch and `TutorialPlayer` mounting stay as they are; no other
guide or smartboard file changes.
