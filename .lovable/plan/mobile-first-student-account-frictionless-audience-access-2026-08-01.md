# Mobile-First Student Account + Frictionless Audience Access

Two outcomes, no feature changes:

1. The existing Student Account adapts itself to phone, tablet and desktop.
2. MathGPL Live audience links and SmartBoard question links open straight into the content, with no account required.

## 1. Hybrid responsive navigation (students)

One navigation component with three shapes, chosen automatically from screen width:

- **Phone (< 768px)** — fixed bottom bar with five primary destinations: Home, Classes, Board/Session, Reports, Profile. Everything else (Lesson Notes, Assignments, Adventure, Games, Gallery, Assessments, Rewards) lives in a slide-up drawer opened from a "More" action.
- **Tablet (768–1279px)** — vertical icon+label rail on the left, drawer expands to a full side menu.
- **Laptop/desktop (>= 1280px)** — the current header navigation stays exactly as it is today.

The same destinations exist on every device; only the container changes.

```text
phone                tablet               desktop
+---------------+    +--+------------+    +----------------------+
|   content     |    |ra|  content   |    | header nav           |
|               |    |il|            |    +----------------------+
+---------------+    |  |            |    |  content             |
|H  C  B  R  P |    +--+------------+    +----------------------+
+---------------+
```

## 2. Student pages made touch-native

Every page under `/student/*` (Classes, Class dashboard, Lesson Notes, Assignments, Assessments, Adventure, Games, Gallery, Reports) gets:

- single-column stacking on phones, 2-up on tablets, current grid on desktop
- minimum 44px touch targets on all buttons, chips and list rows
- no horizontal page scroll: wide tables and charts scroll inside their own container with a sticky first column
- safe-area padding so the bottom bar clears Android/iOS system gestures
- headers converted to the grid + `min-w-0` + `shrink-0` pattern so titles truncate instead of clipping

## 3. Student SmartBoard on touch devices

The board keeps every capability; the shell adapts:

- writing/drawing switches to unified pointer events with `touch-action: none` on the canvas, so a finger or stylus draws instead of scrolling the page
- floating numbers become drag-and-drop via pointer events with a larger hit area, plus a tap-to-select then tap-to-place fallback for small screens
- the tool rail collapses into a compact bottom toolbar on phones; panels (floating numbers, reasoning, properties) become swipe-up sheets instead of fixed side docks
- pinch-to-zoom and two-finger pan on the board surface; single finger always writes
- landscape phones get a reduced-chrome mode so the board keeps most of the viewport

## 4. Audience access — no account needed

Today everything under `/live` is behind the platform sign-in gate, so audience links bounce visitors to `/auth`. That gate moves off the audience routes:

- `/live/join`, `/live/join/:code` and `/live/s/:sessionId` become public. The auth wrapper stays on the teacher-facing `/live` hub, sessions, workspace, lesson-notes, gallery and reports routes.
- The participant page no longer redirects unauthenticated visitors: it loads the session and joins as a guest.
- **Name only if the teacher requires it** — each session and each smart card carries an "ask participants for a name" switch. When off, the visitor lands directly in the content as an auto-labelled guest. When on, one inline name field appears over the content before the first submission; no separate page, no password.
- Guest identity is a locally stored token so a refresh keeps the same participant.
- SmartBoard question links (`/c/:slug/solve`, `/card/...`, `/challenge/...`) already avoid sign-in; they get the same guest-name switch, the responsive treatment, and a direct-to-activity landing with no intermediate page.

## 5. Audience responsive shell

Audience and question-link pages use the same breakpoint system as students: phone gets a single column with a compact action bar, tablet gets a two-column split, desktop keeps today's layout. No bottom tab bar here — audience access is single-purpose.

## 6. Performance on low-power Android

- code-split the board, 3D and game bundles so a student's first paint doesn't load them
- animations limited to transform/opacity, and honour `prefers-reduced-motion`
- reduce heavy blur/backdrop layers on phones
- image and chart work capped at device pixel ratio instead of always rendering at high resolution

## Technical notes

- New `useBreakpoint()` hook returning `phone | tablet | desktop` (extends the existing `use-mobile` hook rather than replacing it), plus a `StudentShell` layout component wrapping the `/student` route tree.
- Navigation lives in one `StudentNav` component with three render branches; route definitions and page logic are untouched.
- Board touch work happens in `PresentationView.tsx` and its panel components, converting mouse handlers to pointer handlers; the drawing/validation pipeline is unchanged.
- Route-gate change: `src/routes/live/route.tsx` stops wrapping everything; the auth wrapper is applied per teacher route instead.
- Additive migration only: an `ask_participant_name` boolean on `sessions` and on `smart_cards`, defaulting to off, with grants and RLS updated so anonymous visitors can read the session/card row and insert their own attempt.
- Teacher, school and parent dashboards are not restructured; they only receive the shared no-horizontal-scroll and touch-target fixes where a layout currently breaks.

## Not included

- No separate student mobile app and no new student system.
- No feature added or removed anywhere.
- No redesign of the teacher, school, parent or platform-owner consoles.
