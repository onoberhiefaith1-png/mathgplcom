# Split Pro and Free buildings into two pages + new Free artwork

Three changes. Nothing about the Pro building's own look or customization changes.

## 1. Two separate editor pages

Today one page edits both versions through a `?version=` switch, so it reads as a single page.

- `/homepage/building` — **Pro Building** page (exactly today's behaviour, editing your own building).
- `/homepage/building/free` — **Free Building** page (platform-owned advertising building, platform owner only).

The Pro/Free selector stays at the top of both pages but now navigates between the two pages instead of swapping content in place. Each page carries its own title ("Edit Pro Building" / "Edit Free Building"), its own 16 slots, and writes only to its own configuration. Non-owners never see the selector and never reach the Free page.

The same split applies to Change Background and Replace Building so the whole Free set lives on its own routes:

```text
/homepage/background          → Pro background
/homepage/background/free     → Free background
/homepage/building            → Pro building (16 slots)
/homepage/building/free       → Free building (16 slots)
/homepage/replace-building    → Pro replacement building
/homepage/replace-building/free → Free replacement building
```

## 2. New default artwork for the Free building's 8 outer images

The uploaded billboard palace becomes the Free building's default for the **eight outer ring positions** (the MathGPL hub images and the five mathematics-branch images). Background removed, so it sits transparent on the scene exactly like the current ring artwork.

- The eight inner core dome images are untouched.
- This is a *default*, not an override: each of the eight slots still shows Replace Image and reverts to this new billboard artwork rather than to the old ring art.
- The Pro building keeps its existing eight ring images as its defaults.
- Because the ad billboard maps to these eight outer positions, ad media continues to paint over them when a slot is active; empty slots show this new artwork.

## 3. Pro / Free switch on the homepage rotating building

On the main dashboard homepage, a small labelled switch (platform owner only) sits with the existing Settings control:

```text
BUILDING   [ PRO ]   [ FREE ]
```

- **PRO** renders your own building with no advertisements (the normal owner view).
- **FREE** renders the platform Free building with the billboard and advertisements running, so it can be checked live.
- The label always states which version is on screen.
- The switch is preview-only: it changes nothing that other accounts see, and it never appears for teachers, schools, parents or students — their building is still decided by their plan and workspace.

## Technical notes

- Add `src/routes/homepage/*/free` route files (or `free.tsx` leaves) pointing at the existing page components with a `version="free"` prop; `useBuildingVersion` reads the version from the route instead of the search param and `setVersion` becomes a `navigate`, keeping `configMode` resolution (`self` vs `platform-free`) and `ensurePlatformFreeSeeded` as they are. Owner gate stays inside the Free routes.
- Upload the new palace image through `lovable-assets` with background removal, then add a `freeDefaultUrl` to the ring entries in `src/lib/homepage/buildingSlots.ts`, plus a helper `slotsForVersion(version)` used by the building page thumbnails and by `RotatingAdventureScene`'s `ringUrls` when the rendered config is `platform-free`.
- `useBuildingContext` gains an optional `previewVersion` override; `Index.tsx` holds owner-only local state (`pro` | `free`) and passes it in, so `configMode`/`adsEnabled` come from one resolver as today. No second building engine and no change to the billboard/ad rotation code.
