## Problem

Back buttons currently do `navigate(-1)` (or hard-coded parent links). When a page calls `navigate("/somewhere")` on mount (auth checks, redirects, "Back to X" links that push a new entry, dashboard cards linking to a sibling), the browser history becomes:

```
A → B → C → B(push again)
```

so pressing Back yields C → B → C → B — the loop the user is seeing.

`navigate(-1)` cannot fix this because it only replays browser history, which already contains the duplicate push. We need our own stack that records genuine forward navigations and pops one entry per Back press.

## Solution: app-wide NavHistory context + shared BackButton

### 1. New `src/lib/nav/NavHistory.tsx`

- React context holding `stack: string[]` (pathname + search).
- `NavHistoryProvider` wraps `<Routes>` inside `BrowserRouter` (in `src/App.tsx`).
- Uses `useLocation()` + `useNavigationType()`:
  - `PUSH` → append current location to stack (dedupe if same as top).
  - `POP` (browser back/forward) → pop top.
  - `REPLACE` → replace top (so redirect pages don't add an entry).
- Exposes `useNavHistory()` returning `{ canGoBack, goBack(fallback) }`.
  - `goBack(fallback)` pops the top entry and `navigate(-1)` when possible; if the stack has ≤1 entry, `navigate(fallback, { replace: true })`.

### 2. Shared `src/components/common/BackButton.tsx`

Thin wrapper around `useNavHistory().goBack(fallback)` with the same visual style already used in headers (icon + optional label). Accepts a `fallback` prop for direct-entry cases (e.g. Lesson Notes → `/teaching-hub`).

### 3. Replace ad-hoc Back handlers

Swap the existing back handlers to use `BackButton` / `goBack`. These are the current call sites found:

- `src/pages/LessonNotesPage.tsx` (header Back — fallback `/teaching-hub`)
- `src/pages/floating/VerificationPage.tsx`
- `src/pages/floating/ReasoningPage.tsx`
- `src/components/smartboard/TopBar.tsx`
- `src/components/smartboard/PresentationView.tsx` (line ~5465)
- Class pages that use `<Link to="…">` styled as Back (e.g. `ClassLessonNotesPage.tsx` "← Class") — convert to `BackButton fallback={parentPath}`.

Non-back `navigate(..., { replace: true })` redirects (auth gates, "not found" bounces) stay as-is because `REPLACE` doesn't grow the stack.

### 4. Why this fixes the loop

When a page pushes its parent (e.g. dashboard card → detail → "Back" link that pushes parent again), our stack still records only the real forward moves. `goBack` pops one stack entry and navigates to the previous real location — never bouncing between two adjacent entries.

### Out of scope

- No route table changes.
- No changes to auth redirect logic.
- No visual redesign of headers.

## Verification

- Manual: A → B → C → D, press Back four times, land on A.
- Manual: open C directly (fresh tab) → Back uses the provided fallback route.
- `tsgo` typecheck for new files.
