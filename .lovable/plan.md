## Quick Insert (@) with Short Codes

The `@` menu already exists and searches Standard Names. This plan adds a second, uniqueness-enforced identifier — the **Short Code** — plus in-app editing of both names.

### 1. Data model — add short codes to every asset

Extend `AssetDef` in `src/lib/lessonnotes/assets/types.ts`:

```ts
export interface AssetDef {
  id: string;
  label: string;        // Standard Name
  shortCode: string;    // NEW — unique, uppercase, keyboard shortcut
  ...
}
```

Populate `shortCode` on every entry across `symbols.ts`, `structures.ts`, `diagrams.ts`, `graphs.ts`, `tables.ts`, `manipulatives.ts`, `measurement.ts`, `realworld.ts`. Defaults follow the user's table (`FR`, `SQ`, `TB`, `TRI`, `REC`, `CIR`, `BAR`, `HIST`, `PIE`, `GRAPH`, `NL`, `COMP`, `PRO`, …) and are auto-derived for anything not listed (initials → first-3 letters, disambiguated with a numeric suffix).

A build-time check in `registry.ts` throws if any two assets ship with the same default short code — guarantees uniqueness from day one.

### 2. Persisted user overrides

Store per-asset user edits in `localStorage` under `lessonnotes.assetOverrides` as `{ [assetId]: { label?, shortCode? } }`. A small module `assets/overrides.ts` exposes:

- `getEffectiveLabel(a)` / `getEffectiveShortCode(a)`
- `setOverride(id, patch)` with uniqueness validation across effective short codes (returns `{ ok: false, conflictWith }` on clash)
- `resolveByShortCode(code)` — case-insensitive lookup used by the @ menu

`searchAssets` and `AtCommandMenu` read through these accessors so renamed assets appear everywhere immediately.

### 3. @-menu behaviour (`AtCommandMenu.tsx`)

- Search matches both effective label **and** effective short code (short-code exact match ranks highest).
- Each row shows the short code as the right-side hint (replacing the current category hint).
- **Enter key logic**:
  1. If the typed query, uppercased, exactly matches an effective Short Code → insert that asset immediately, ignore highlighted row.
  2. Otherwise insert the highlighted row (existing behaviour).
- Tab still autocompletes to the highlighted label (small addition, keeps flow).

### 4. Editing names — Asset Library ⋮ menu

In the Asset Library gallery card (`src/components/lessonnotes/AssetLibrary*.tsx` — actual file located during implementation), add a ⋮ button opening a small popover with two fields:

```
Standard Name  [Fraction        ]
Short Code     [FR              ]
                [Reset] [Save]
```

On Save, call `setOverride`. On short-code clash show inline error: *"This Short Code is already assigned to <Other Asset>. Please choose a different Short Code."* — Save stays disabled until resolved. Reset clears the override for that asset.

### 5. Smartboard parity

The smartboard already renders lesson-note content through the same TipTap extensions, but it doesn't mount `AtCommand` today. Add the `AtCommand` extension + `AtCommandMenu` to the smartboard editor surface (single file, `src/pages/SmartBoardPage.tsx` or its editor wrapper) so `@FR` + Enter works during a live lesson exactly like in the notebook.

### 6. Out of scope

- Server-side persistence of overrides (localStorage only for now; can be lifted to a `user_asset_overrides` table later without changing the UI).
- Bulk short-code editor / import-export.
- Reassigning short codes to structures created inside the doc (only affects the *insertable* asset registry).

### Files touched

- `src/lib/lessonnotes/assets/types.ts` — add `shortCode` field.
- `src/lib/lessonnotes/assets/{symbols,structures,diagrams,graphs,tables,manipulatives,measurement,realworld}.ts` — populate short codes.
- `src/lib/lessonnotes/assets/registry.ts` — uniqueness check, search over short codes, resolve helper.
- `src/lib/lessonnotes/assets/overrides.ts` — NEW, localStorage layer.
- `src/components/lessonnotes/AtCommandMenu.tsx` — Enter-by-short-code, show code in row.
- Asset Library card component — ⋮ edit popover.
- Smartboard editor surface — mount `AtCommand` + `AtCommandMenu`.
