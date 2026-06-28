
## Step Animation + Math Objects for Lesson Notes

Two new editing capabilities added directly to the existing `DocumentEditor` toolbar — neither is a new section type. Both work anywhere inside a lesson note.

---

### Part 1 — Step Animation

**Toolbar**
Add to `DocumentEditor.tsx` next to existing tools:
- `Animate` toggle (Film icon) → enters Animation Mode (local editor state).
- When ON, a second button appears: `Capture Step` (Camera icon).

**New TipTap node**: `stepAnimation` (block, atomic).
- `attrs: { frames: Array<{ id, contentJson, label? }>, currentFrame: number }`
- NodeView (`StepAnimationView.tsx`): renders the current frame's content inline (read-only preview), with a small frame strip below showing thumbnails, frame number, delete/insert/reorder controls.

**Capture flow**
1. Teacher selects a range (or whole block) in the editor.
2. Presses `Capture Step`.
3. If selection is inside an existing `stepAnimation` node → append the new snapshot to that node's `frames`.
4. Otherwise → wrap the selection in a new `stepAnimation` node with the selection as frame 1; further captures while selection sits inside this node append frames.
5. Teacher continues editing the *live* (last) frame in place; pressing Capture again snapshots the current state as a new frame.

**Frame editing**
Inside the NodeView strip:
- Click frame → make it the active/visible frame (editable via "Edit frame" button that swaps node content with that frame).
- Delete frame, duplicate frame, insert blank frame between two, drag-reorder.

**Presentation Mode**
Update `SmartBoardPage` / present flow to recognize `stepAnimation` nodes:
- Each `Next` press advances `currentFrame` by 1 within the node before moving to the next block.
- `Previous` goes back through frames then to prior block.
- No auto-play.

---

### Part 2 — Math Objects

**Toolbar**
Add `Math Objects` button (Shapes icon) → opens a popover picker.

**Picker** (`MathObjectsPicker.tsx`)
Categories: Everyday, Money, Probability, Transport, Animals, School, Science.
Each object is a small flat SVG component (no external images) defined in `src/lib/mathObjects/catalog.tsx`. ~50 objects total in first pass.

**New TipTap node**: `mathObject` (inline, atomic).
- `attrs: { kind: string, size: number, count: number }`
- NodeView renders the SVG, supports drag-resize (corner handle), click to select.
- Duplicate / delete via existing selection toolbar; copy/paste works via standard TipTap.

**Interaction**
- Click in picker → inserts the object at cursor.
- Resize via handle (updates `size` attr).
- Multi-insert: shift-click picker inserts N copies (default 1).

**AI integration**
Extend `AiEditPanel` / `notebook-ai` edge function:
- Serialize `mathObject` nodes into the AI context as `[object:car]`, `[object:apple x3]`.
- Add tool actions: `replace_object(from, to)`, `duplicate_objects`, `group_objects(n)`, `objects_to_variables(mapping)`.
- AI returns transformed node tree; client applies.

---

### Files

**New**
- `src/components/lessonnotes/extensions/StepAnimation.tsx` — TipTap node + NodeView
- `src/components/lessonnotes/extensions/MathObject.tsx` — TipTap inline node + NodeView
- `src/components/lessonnotes/math-objects/MathObjectsPicker.tsx`
- `src/lib/mathObjects/catalog.tsx` — SVG components + category index
- `src/lib/lessonnotes/animation.ts` — capture/serialize helpers

**Edits**
- `src/components/lessonnotes/DocumentEditor.tsx` — register nodes, add 3 toolbar buttons (Animate toggle, Capture Step, Math Objects), animation mode state.
- `src/pages/SmartBoardPage.tsx` (or whichever drives Present) — frame-aware Next/Previous.
- `supabase/functions/notebook-ai/index.ts` — recognize math-object tokens; add edit verbs.

No DB schema changes — both nodes serialize inside `document_json`.

### Out of scope (later)
- AI auto-generating animation frames from a solution
- Custom user-drawn math objects
- Export of animations to DOCX (will export as final frame only)
