# Rebuild the Game writing-surface renderer so it always appears

## Confirmed investigation result

The affected Game is not empty or deleted. Its saved record still contains:
- 50 writing surfaces
- the Plain surface and saved colour
- saved text and number styling
- the saved video background
- the complete Game settings

The blank result comes from the drawing path, not missing teacher work:
- The page currently uses the same silent blank screen for loading, delayed 3D assets, and failure, so the user cannot distinguish them.
- All writing surfaces wait behind one shared 3D loading boundary. A delayed room, material, reward, or lighting file can therefore prevent every writing surface from appearing.
- Surface loading and unrelated reward/effect loading are coupled together.
- Graphics recovery only performs its full rebuild once per page session; another graphics loss can leave the board blank.
- Saved data is normalized, but the load boundary does not guarantee at least one valid renderable surface if malformed data is ever encountered.
- Long-lived texture caches are not bounded or released, increasing graphics-memory pressure across repeated visits.

## Rebuild scope

Replace the fragile writing-surface startup and rendering path. Do not delete or redesign the Game editor, Slate Artisan visuals, teacher configuration, saved Games, rewards, Vaults, Floating Numbers, or Play behavior.

### 1. Create an always-valid surface model

Before the 3D view starts, validate the loaded Game and produce a render-safe surface list:
- preserve every valid saved surface exactly
- repair missing optional values with existing defaults
- ignore only an individually invalid surface field
- create one temporary visual fallback only if a record truly has no renderable surfaces
- never save that fallback over teacher data without an explicit teacher save

The saved Game remains the source of truth.

### 2. Rebuild surface startup in independent layers

Start the essential writing surfaces first, using a dependable built-in material path that cannot wait on reward, effect, room, background, or decorative files.

Load these separately afterward:
1. room and lighting
2. selected material detail
3. background image/video
4. rewards and effects

A failure or delay in one optional layer must not hide the writing surfaces. Each surface must have its own failure boundary so one bad asset cannot blank the entire board.

### 3. Remove silent blank states

Replace every black/null startup state with a visible board shell and status:
- “Loading your Game…” while saved data is loading
- the writing-surface fallback while material detail is loading
- “Restoring the board…” only during an actual graphics interruption
- a retry control if recovery cannot finish

The page must never present an unexplained empty area.

### 4. Make graphics recovery repeatable

Rewrite the Game-specific graphics recovery so it can recover more than once in the same visit:
- preserve the current Game state and editor selections
- try browser restoration first
- rebuild only the 3D drawing view when restoration times out
- permit later recovery attempts without an infinite reload loop
- verify the rebuilt canvas contains visible writing surfaces before removing the recovery notice
- fall back to the dependable surface renderer if enhanced materials repeatedly fail

### 5. Control graphics memory

Prevent repeated visits from gradually exhausting graphics memory:
- stop preloading every surface and reward asset before the board can appear
- load only assets used by the visible Game
- reuse identical material maps rather than creating size-specific texture copies
- dispose replaced video/material/texture resources when the Game changes or the view closes
- keep the saved 1 GB upload allowance, while ensuring large backgrounds cannot block or erase the surfaces

### 6. Protect save and reopen behavior

Keep save/load canonical and defensive:
- Save must persist the complete teacher configuration, as it does now.
- A render failure must never write empty surfaces or defaults back to storage.
- Reopening must reconstruct the exact saved surfaces, text style, background, rewards, and positions.
- Add validation before save so an accidental empty or invalid render state cannot overwrite a valid Game.

### 7. Remove the stray screen-stopping error

Trace and eliminate the current `v is not defined` browser error. Add source-mapped error reporting around the Game drawing entry so any future failure identifies the exact layer instead of producing a blank screen.

## Required verification

Test the affected Game with its real saved configuration:
1. Open Edit from a cold browser cache: surfaces appear before optional artwork finishes.
2. Reload and reopen the Game at least 20 times: surfaces appear every time.
3. Navigate away and back repeatedly: no growing graphics-memory failure.
4. Force graphics loss twice in one visit: surfaces recover both times without losing settings.
5. Fail one material, reward, room, and background request separately: writing surfaces remain visible.
6. Open with the saved video background: the background cannot cover or block the surfaces.
7. Save, close, and reopen: the Game matches the saved teacher design exactly.
8. Open Play: the same surfaces appear and existing Floating Numbers line activation still works.
9. Test desktop and mobile independently without changing the established mobile layout.
10. Confirm no blank/null loading screen and no `v is not defined` error remain.
