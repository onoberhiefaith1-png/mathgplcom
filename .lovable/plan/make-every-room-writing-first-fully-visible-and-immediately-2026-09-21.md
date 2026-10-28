# Make every room writing-first, fully visible, and immediately responsive

## Confirmed problems

The supplied room screenshot confirms that the writing surface is wider than the room's visible opening: text and metal extend behind both side walls. The current safety calculation protects only rooms tagged with pillars, door frames, tablet stands, or timber posts; Forge, Library, Treasure, Armoury, Glass, and Ice currently receive no room-safe writing boundary even though their walls or foreground objects can cover the board.

The shown metal plate uses the current photographic metal scan, while the Forge room itself explicitly uses the `rust-metal` family. Existing metal recipes also add heavy scratches. This creates the unwanted rusty, used appearance.

Room mode also runs animated flames, smoke, embers, dust, multiple lights, large shadows, photographed environment lighting, and props alongside the writing renderer. These layers are not part of Floating Numbers, but they consume the same frame budget and can make room-based entry feel rigid while roomless entry remains responsive.

## Build

### 1. Give every room an exact visible writing opening

Define a room-specific safe opening for all nine room types, based on the actual side walls and every foreground object at its real depth.

For each room:

- project the left and right visible boundaries to the writing-surface depth;
- reserve a small visual clearance so letters, surface edges, numbers, and decorations never touch or enter a wall;
- use the narrower of this room opening and the normal 5%–95% screen band;
- anchor the surface and its local text box together inside that opening;
- keep short surfaces compact and allow long surfaces to grow only to the safe right boundary, then wrap downward.

This will apply identically in Edit and Play so the teacher sees exactly what students receive.

### 2. Make room walls unable to cover writing interaction

Keep the room as scenery, not as an input layer:

- ensure the complete visible writing surface has the frontmost reliable click/touch target;
- prevent decorative room meshes, lights, particles, and props from intercepting surface selection;
- preserve direct line selection, scrolling, caret placement in Edit, and Floating Numbers line activation in Play;
- retain the same active line while the surface grows or room decoration updates.

No Floating Numbers, grading, reward, Vault, timer, or saved-stage behavior will change.

### 3. Replace rusty and distressed writing finishes with clean, new materials

Refresh the writing-surface finishes without changing the available surface choices or their identities:

- Metal Plate becomes clean, even, newly manufactured metal with restrained reflection, no rust, and no heavy scratch treatment.
- Shield and other metal writing surfaces use clean premium metal rather than the rusty family.
- Stone, wood, parchment, glass, ice, cloud, and decorative surfaces keep realistic depth but remove excessive grime, damage, jitter, or wear that makes them look old or unpleasant.
- Preserve each material's recognizable character, teacher-selected colour, text contrast, and physical depth.
- The Forge room may remain a forge, but its writing plate will look clean and fit for teaching rather than corroded.

### 4. Keep room rendering responsive to every click

Make the writing and Floating Numbers response the highest-priority work:

- move nonessential room animation and decorative updates behind the already-ready writing layer;
- pause or reduce off-screen and low-value particles, flame detail, and shadow work when needed;
- avoid room material or lighting updates rebuilding writing surfaces;
- keep the immediate text path independent from photographed textures and room effects;
- preserve the current visual room designs while applying adaptive quality to decoration only.

### 5. Add safeguards against recurrence

Add focused tests for:

- a safe opening for every room definition, including rooms without pillars;
- left and right text edges remaining inside each projected room opening;
- Edit and Play using the same room-safe box;
- clean metal mappings never selecting the rusty family or heavy scratch recipe;
- room decoration not changing the active line or blocking writing input.

## Verification

1. Open every room in Edit and Play at the same desktop size.
2. Confirm every character, panel edge, line number, and visible decoration stays clear of both side walls and foreground objects.
3. Test short, long, centred, left-aligned, and right-aligned writing; long content wraps inside the room opening.
4. Rapidly enter Floating Numbers on Lines 1–3 in every room and confirm each tap appears immediately on the matching surface.
5. Click each surface repeatedly in Edit and confirm selection and writing respond immediately.
6. Scroll from Surface 0 to the final surface without clipping, overlap, or line reversion.
7. Inspect every writing material under room lighting; confirm all look clean, new, legible, and premium, especially both Metal Plate options and Shield.
8. Confirm roomless mode remains unchanged and responsive.
9. Run the focused layout, room-boundary, text, and Game tests plus the project type check.

## Not changing

No redesign or replacement of Slate Artisan, Floating Numbers, mathematics, grading, rewards, Vault behavior, room selection, camera, saved teacher settings, or Game runtime structure.
