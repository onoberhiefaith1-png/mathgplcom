# The MathGPL building becomes the universal default and the first page

## 1. Your current artwork becomes the built-in default

Right now the five images you replaced (Image 1, 3, 5, 7 and 8 — the ring slots) live as personal overrides on your account, while the shipped originals (Algebra, Geometry, Trigonometry, Statistics, Calculus islands) are still what "default" means for everyone else and what the recycle button restores.

- Publish your five current images as permanent CDN assets and set them as the `defaultUrl` for those slots in `buildingSlots.ts`.
- Delete the five old island artworks so nothing can fall back to them.
- Clear the now-redundant overrides from your own account, so your homepage renders the shipped default — one single source of truth.
- The recycle (revert) button then means exactly "back to the MathGPL building" with these images. The three MathGPL-hub ring slots and the 8 dome-core slots keep their existing artwork, which you never replaced.

## 2. The building is the first page of every workspace

Rule: MathGPL is the school; Teaching Hub, School Administration, Family and Student Classes are classrooms inside it. You always arrive at the school first.

- Sign-in already lands on the building. The gap is workspace switching: switching from inside Teaching Hub or Administration keeps you on that page. After every workspace switch the app navigates to `/` so the newly entered workspace opens on its building.
- Same for the platform-owner "Enter Workspace" path: it opens the building, not a dashboard.

## 3. Whose building shows

| You are | Building shown |
| --- | --- |
| Owner of the workspace, no custom building | The MathGPL building (new defaults) |
| Owner who replaced the building | Their own building, from then on |
| Teacher/parent inside a school workspace | The school's building (school dominates) |
| Student | MathGPL building on the front page; the school/teacher building when they enter that workspace |

This inheritance already works through the workspace-scoped config; the plan tightens the editing rights so they match the rule:

- Only the workspace owner sees Homepage settings (Change Background / Edit Building / Replace Building). A teacher inside a school workspace sees no building controls — the school owns it.
- Students never see building controls in any workspace.
- Falling back is automatic: a workspace with no custom building renders the MathGPL default.

## 4. Readable country list

The country dropdown on the signup/login forms inherits the dark auth theme, so the list is unreadable. The picker (list panel, search box, options, hover and selected states) is forced to a white background with black text, matching the other auth fields.

## Technical notes

- `src/lib/homepage/buildingSlots.ts` — new `defaultUrl` values from `lovable-assets` pointers for `ring-0/2/4/6/7`; remove the five unused island asset pointers.
- One-off data cleanup: strip `slotOverrides` for those slots from your profile's `homepage_config`.
- `src/lib/accounts/useWorkspace.ts` (or the switcher) — navigate to `/` after `switchTo`; same in the admin impersonation entry.
- `src/pages/Index.tsx` / `HomepageSettingsButton` — gate the settings entry on workspace ownership plus a non-student role.
- `src/components/auth/CountrySelect.tsx` — light-surface classes on `PopoverContent`/`Command`.

No schema changes, no changes to the building's geometry, and the Community mirror is untouched.
