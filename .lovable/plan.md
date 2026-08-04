# Remove the white flash + a view-only student Academy page

## 1. The white rectangle on load

Confirmed cause in `src/components/adventure/RotatingAdventureScene.tsx`: the inner palace core
renders 12 curved panels via `CoreSegment`, using `textures[i % textures.length]`. Until the core
artwork finishes decoding, `textures` is empty, so `i % 0` is `NaN`, the texture is `undefined`, and
each panel paints as an untextured **white** mesh — the large white curved rectangle in the centre.
The outer ring already guards this (`if (!texture) return null`); the core does not.

Fix:
- Skip the core entirely until at least one core texture has decoded, and skip any individual panel
  whose texture is missing (same guard as the ring segments).
- Hold the scene's fade-in until the first ring texture and the core texture are decoded, so the page
  dissolves straight from the background into the finished building — no white box, no blank panel.

No skeleton or loader is introduced; the sunset background stays visible the whole time.

## 2. Student Academy page (view-only)

Today `/` renders one Index page for everyone: search bar, Account menu, Settings, Backgrounds,
Assets, MathGPL Community, Teaching Hub/Join Class, and the level panel.

Change: when the signed-in role is `student`, `/` renders a stripped Academy page containing only

- the academy background and rotating building, and
- a single **Join Class** button that opens the join-code screen (`/join`).

Everything else is hidden for students: search bar, Account menu, Settings gear, Backgrounds,
Assets, Community, Teaching Hub, level navigation. Building segments become non-clickable for
students, so there is no route into teacher tools from the artwork. Teachers, schools, parents,
and owners keep the current page exactly as it is.

### Mirroring the school's academy

The academy a student sees is their **school's** academy (the organization owner's saved homepage
configuration), and it updates automatically whenever the school changes it.

- Add a read path so a member can read their organization owner's `homepage_config` (a
  security-definer database function scoped to the caller's own organization, exposing only that
  config column — no other profile data).
- `useHomepageConfig` gains a read-only mode: for students it loads the school's config instead of
  their own, never writes, and skips local caching of someone else's theme.
- Students with no organization fall back to the shipped MathGPL academy artwork.

## Technical notes

- `RotatingAdventureScene.tsx`: guard `CoreSegment`/`CentralCore` on decoded textures; gate the
  opacity fade on textures ready rather than only `ready`; accept an `interactive={false}` mode used
  by the student page.
- `src/pages/Index.tsx`: branch on `useAccount().role === "student"` to render the minimal academy
  (scene + one Join Class link), otherwise the existing full page.
- `src/lib/homepage/homepageConfig.ts`: add `useHomepageConfig({ mode: "school-readonly" })` used by
  the student branch.
- Migration: additive `SECURITY DEFINER` function returning the org owner's `homepage_config` for the
  caller's organization, granted to `authenticated`.
