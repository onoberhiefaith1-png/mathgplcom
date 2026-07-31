# Homepage Customization System

Three independent features, reachable from a new gear button on the Homepage, each saved per signed-in account.

```text
Homepage
├── Background   (image / animated image / looping video)
└── Building     (in front, never affected by the background)
```

## Entry point

A settings gear appears on the Homepage (top bar, next to Account). It opens a "Homepage Customization" sheet with exactly three options:

- Change Background
- Edit MathGPL Building
- Replace Building

Signed-out visitors see the default homepage and no gear. Each signed-in account keeps its own homepage look; changes never affect other accounts.

## 1. Change Background

Opens the existing Adventure background workflow (same upload / asset-library / preview flow used for adventure backgrounds, with "Reward" wording changed to "Building"). Accepts image, animated image (GIF/WebP) or looping video.

Applying a background swaps only the layer behind the building. The rotating building, all buttons, and the whole interface stay exactly where they are. Video backgrounds play muted, looped, autoplay, object-cover.

## 2. Edit MathGPL Building

Only for the original MathGPL building. It lists its 16 slots:

- 8 outer ring segments (Algebra, MathGPL, Geometry, MathGPL, Trigonometry, MathGPL, Statistics, Calculus)
- 8 inner core dome positions

Each row shows a thumbnail plus a single action: **Replace Image**. Nothing else — no move, resize, rotate, recolour, or restyle. Replacing a slot keeps its exact position, curve, perspective, scale, radius, overlap, render order, and rotation; only the artwork changes. Each slot can be reverted to its original artwork individually.

## 3. Replace Building

Replaces the whole building with a single asset (one image or one looping video) instead of per-slot artwork.

Opening it goes to a dedicated editing workspace built on the existing visual editor (canvas + settings panel + asset library), with "Reward" renamed to "Building". Inside it the user can upload a building, preview it, and adjust position, size, scale, rotation, opacity and the other visual settings the editor already offers. The Homepage is untouched while editing.

A final **Apply Building** button validates that an asset is selected and loads, then makes it the Homepage building. Until Apply is pressed, the Homepage keeps its current building. A "Restore MathGPL building" action returns to the original 3D building at any time.

## Isolation rules

- Change Background writes only background state.
- Edit MathGPL Building writes only per-slot artwork of the original building.
- Replace Building writes only the custom-building record and does not touch the 16 slots — restoring the MathGPL building brings back the user's slot replacements intact.

## Technical notes

- Migration (additive only): add `profiles.homepage_config jsonb default '{}'` holding `{ background: {kind, url|path}, buildingMode: 'mathgpl'|'custom', slotOverrides: {slotId: assetUrl}, customBuilding: {...transform} }`. Grants/RLS already cover `profiles` self-updates; verify before relying on them.
- New hook `src/lib/homepage/useHomepageConfig.ts` — local-first read (like `useDashboardBackground`) plus profile persistence.
- Uploads reuse `uploadGameAsset` / `game_assets` + the existing signed-URL helpers; no new bucket.
- `RotatingAdventureScene.tsx`: replace the hardcoded `adventureClouds` layer with a config-driven background layer (img or video), and drive segment/core textures from `slotOverrides` with the existing geometry constants untouched. When `buildingMode === 'custom'`, render the custom asset via the existing `SignedMedia`/`ChromaVideo` components in place of the Canvas, background layer unchanged.
- New routes: `/homepage/background`, `/homepage/building`, `/homepage/replace-building`, each with its own `head()` metadata.
- The Replace Building workspace reuses `GameCanvas`, `SettingsPanel`, `AssetLibraryModal` and `EffectsRail` in a `mode="building"` variant of the editor page so the tools stay identical.
