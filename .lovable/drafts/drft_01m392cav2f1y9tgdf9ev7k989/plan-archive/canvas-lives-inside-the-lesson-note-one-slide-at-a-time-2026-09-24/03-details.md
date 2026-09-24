## How it will be built

**Inline Canvas viewer (replaces the list gateway)**
- `CanvasSessionGateway.tsx` becomes a bound viewer: when the heading carries `canvasId`, it renders one `SlideStage` at the current slide with left/right chevron buttons, a subtle `2 / 6` counter, and disabled ends. When nothing is bound, it shows a compact "Choose Canvas" row listing the named Canvases; a small control on the block allows changing or clearing the choice later.
- It reuses `listCanvasSlides` + `listSlideItems` + `SlideStage`/`SlideMedia`, so the picture geometry is identical to the panel, Preview and Smartboard.
- Step reveals inside a slide stay as they are; the note-level chevrons walk slides.

**Heading shows the Canvas name**
- `SectionHeading.tsx`: for `kind === "canvas"`, the visible heading text renders the Canvas name when `canvasId` resolves, falling back to `Canvas`. The name is stored on the heading (`canvasName` attr) so outline, `lessonOutline.ts`, `syncDocumentToNotebook.ts` and the Smartboard all read the same label without an extra fetch.
- `SectionNav` therefore lists `clo` rather than `Canvas`.

**Proportional region**
- Add a `canvasScale` heading attribute (fraction of the note text width, 0.3–1.0). The edit panel writes it from its own width relative to the workspace width, so panel proportion = page proportion. The inline block uses `width: calc(<scale> * 100%)` with a 16:9 aspect box, and the Smartboard uses the same fraction against its stage width. No schema change — the value lives on the heading node.

**Always-visible expand control**
- `SlidePanel.tsx` keeps the drag grip but gains a persistent header button that cycles narrow → default → full frame (and back), plus the same button in the collapsed state. Width still persists per notebook in session storage, now also mirrored into `canvasScale`.

**Smartboard**
- `PresentationView.tsx`: the Canvas session beat renders the bound Canvas inline at `canvasScale` with the same chevrons, advancing one slide per Next, rather than exposing a separate "Choose one Canvas" menu. The existing full-screen `SlidePlayer` stays available for presenting a Canvas on its own.

**Verification**
- Bind `clo` to a Canvas session, confirm the heading reads `clo`, walk slides 1→6 inline in the note, expand the panel to full frame and confirm the note block grows to full width, then open the Smartboard and confirm the same session shows slide 1 and advances on Next.
