## Steps

1. Add a subject list (six subjects, each with sections, entries and a status: ready / pending / coming soon) as plain data, so a future subject is one new data file.
2. Mathematics: wrap the current registry unchanged as the Mathematics subject.
3. Physics: expand the existing Physics data to cover all 17 sections from your specification, with symbol, meaning, unit, other meanings and short code.
4. Chemistry: new data file with all 118 elements and the 14 symbol families from the document; apparatus and hazard pictograms registered as pending.
5. Add the subject tabs and per-subject search to the existing Asset Library dialog; the active subject is excluded from the tabs.
6. Tests: tab exclusion rule, 118 unique element symbols, every Physics section present and non-empty, Mathematics asset count unchanged, no content shared between subjects. Then a phone and desktop browser check.

## Technical details

- New `src/lib/lessonnotes/assets/subjects/` (`index.ts`, `physics.ts`, `chemistry.ts`, `types.ts`); Mathematics subject reads `ALL_ASSETS` as-is.
- `AssetLibraryDialog.tsx` gains a `subject` state and tab strip; Mathematics branch renders the current body untouched. Physics/Chemistry entries insert as plain text symbols through the existing insert path only inside the library (no new Smartboard/Game wiring).
- No database changes. The existing `@` picker and Copilot Physics standard are not modified.
- Record the subject-library rule in `src/lib/lessonnotes/AGENTS.md`.
