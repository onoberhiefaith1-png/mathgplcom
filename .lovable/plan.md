# Stop the homepage building from flashing in and out

## What's happening

The console from your session shows `THREE.WebGLRenderer: Context Lost.` repeating dozens of times. That's the give-away: the 3D building isn't animating badly — it is being **torn down and rebuilt over and over**, and each rebuild shows a blank sky for a moment before the building fades back.

Two things in `RotatingAdventureScene.tsx` cause the loop:

1. **The canvas is keyed on its artwork URLs.**
   `key={`${ctxKey}-${ringUrls.join("|")}-${coreUrls.join("|")}`}`
   Homepage config loads in stages (local cache → account row), and any private-storage slot resolves to a freshly-signed URL each time. Every one of those changes produces a new key, which destroys the whole canvas and creates a brand-new WebGL context.
2. **Context loss is handled by remounting.** Both a window listener and a canvas listener bump `ctxKey`, so one lost context creates a new canvas — and because the discarded contexts pile up, the browser drops them again. Loss → remount → loss becomes a self-feeding cycle, exactly the "come, disappear, come, disappear" rhythm.

Also, `<Suspense fallback={null}>` means whenever a texture re-loads, the entire scene renders as nothing instead of holding the previous frame.

## The fix

**One canvas, mounted once, for the life of the page.**

- Remove the URL segments from the canvas `key`. The canvas keeps a stable identity; artwork changes are applied to the existing scene instead of recreating it.
- Load textures inside the scene and swap them onto the existing meshes when a URL changes, so a new signed URL updates the material and never unmounts the canvas.
- Wait for `useHomepageConfig().ready` before the first paint of the 3D scene, so the scene starts with its final artwork and there is no early-render/rebuild step.

**Recover from context loss without remounting.**

- Keep a single `webglcontextlost` handler on the canvas element (drop the duplicate window listener), `preventDefault()` it, and restore on `webglcontextrestored` — the standard, no-remount path.
- Guard remounting as a last resort: at most one remount, and only if no `webglcontextrestored` arrives within a couple of seconds. No repeat loop is possible.

**Make any transition read as smooth, never as a flash.**

- Replace `fallback={null}` with a fallback that keeps the background sky visible, and fade the canvas in with a short opacity transition once the first frame is drawn, so even a genuine reload looks like a soft dissolve.
- Lower the renderer's memory pressure so loss is less likely in the first place: cap `dpr` at 1.25–1.5, and mark textures for GPU-friendly settings (mipmaps + `generateMipmaps` already implied by anisotropy) rather than raising quality.

## Scope

Presentation only, all inside:

- `src/components/adventure/RotatingAdventureScene.tsx` — canvas key, context-loss handling, texture swapping, fade-in.
- `src/lib/homepage/homepageConfig.ts` — memoize resolved slot URLs so an unchanged override doesn't produce a new URL string on every resolve.

No database, routing, or feature changes. The Community mirror (`routeFor`) keeps working unchanged, since it renders the same component.

## How I'll verify

Load `/` in a headless browser, watch for 10+ seconds, and confirm the console records zero `Context Lost` messages and the building renders continuously (screenshots at intervals showing the building present each time).
