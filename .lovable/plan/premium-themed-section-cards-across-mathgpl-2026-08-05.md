# Premium themed section cards across MathGPL

First pass of the Premium AI Wallpaper System: replace plain white content cards with a single shared set of premium themed gradients, so every page already belongs to one world before the wallpaper engine is built.

## What exists today

- `src/pages/TeachingHub.tsx` already passes per-tile `accent` gradient strings into `WorkspaceCard` via `WorkspaceShell`. The gradients are ad-hoc strings duplicated at each call site.
- Other surfaces (Classes, class workspace, admin console, community sections) use white/elevated cards on navy — visible in the screenshots as bright white blocks.
- Homepage background customization already exists (`src/lib/homepage/homepageConfig.ts`, image/video layers + AI generate route `src/routes/api/course-background.ts`) and is the natural foundation for the later wallpaper engine. Not touched in this pass.

## The change

### 1. One theme registry

New `src/lib/theme/sectionThemes.ts` — a single source of truth mapping each module to its identity:

| Module | Identity |
| --- | --- |
| Lesson Notes | warm bronze → gold |
| SmartBoard | blue → purple |
| Classes | deep teal |
| Adventure | orange → purple sunset |
| Skill Builder | emerald |
| Reports | dark navy |
| Gallery | royal purple |
| Rewards | gold / crystal |
| Assessment | deep blue with soft lighting |
| Community | multi-colour friendly gradient |

Each entry exposes a gradient, border, icon tint, text tint and hover glow. Values are semantic tokens defined in `src/styles.css` (no hardcoded `bg-white` / hex in components), so they theme cleanly and stay contrast-safe.

### 2. A premium card primitive

Extend `WorkspaceCard` (and add a small `SectionCard` for non-tile surfaces) to accept a `theme` key instead of a raw class string: gradient surface, thin luminous top edge, soft inner light, subtle noise/vignette, and a readability layer so title/description keep AA contrast on every gradient.

### 3. Apply it page by page

Convert the white card surfaces to themed cards on:

- Teaching Hub (`TeachingHub.tsx` → theme keys, drop the inline accents)
- MathGPL Live hub (`live/LiveHub.tsx`)
- Classes list + Create/Join Class (`ClassDashboardPage.tsx`, `CreateClassPage.tsx`, `JoinClassPage.tsx`)
- Class workspace cards (Students, Lesson Notes, Board, Gallery, Reports, Assessment)
- Admin console stat cards (`/admin`)
- Community sections (`community/CommunitySectionPage.tsx`)
- Student shell tiles (kept simpler and higher-contrast for students)

Layout, routing and behaviour are unchanged — only surface styling.

### 4. Readability and mobile

Every themed card keeps a dark scrim under text, minimum 44px touch targets, and gradients tuned so they stay legible at phone width. No animation in this pass beyond existing hover transitions.

## Deliberately deferred (next pass, per your answers)

The AI wallpaper engine — Change Background / Generate with AI / Upload / Wallpaper Library / Reset, the generator dialog (prompt, negative prompt, style, lighting, colour theme, preview/regenerate/save/use), overlay + smart colour matching, the wallpaper editor, per-module wallpapers, **animated wallpapers**, and **publishing to MathGPL Community** — is planned as the next phase, editable by **any signed-in account** for their own pages. The theme registry built here becomes the fallback and the colour-matching target for that engine.

## Verification

Load Teaching Hub, Classes, a class workspace, `/admin` and Community at desktop and phone widths; confirm no white blocks remain, each module reads as its own colour, and all text passes contrast.

## Files

- new `src/lib/theme/sectionThemes.ts`
- new `src/components/ui/SectionCard.tsx`
- `src/components/workspace/WorkspaceCard.tsx`, `WorkspaceShell.tsx`
- `src/pages/TeachingHub.tsx`, `src/pages/live/LiveHub.tsx`, `src/pages/ClassDashboardPage.tsx`, `src/pages/CreateClassPage.tsx`, `src/pages/JoinClassPage.tsx`, class workspace + admin + community section pages
- `src/styles.css` (theme tokens)
