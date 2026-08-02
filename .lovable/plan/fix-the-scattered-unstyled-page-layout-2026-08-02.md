# Fix the scattered / unstyled page layout

## What is actually happening

The page content is all there, but **the app's stylesheet is not being delivered**, so every element falls back to raw browser defaults — that is the "scattered" look.

Confirmed by loading the app in a real browser:

- `GET /src/styles.css` returns **404** (the app's own 404 HTML page, not CSS).
- A test element with the `flex` class computes to `display: block`, proving no Tailwind CSS is applied at all.
- Other source URLs (`/src/routes/index.tsx`) also 404, and one render returned the "404 Oops! Page not found" component with only the root route matched — the dev server's module graph and route tree are in a broken state after the recent crash.
- The dev server process is alive but pinned at ~89% CPU, consistent with a stuck/thrashing state rather than an application bug.

So there are two candidate causes, in order:

1. **Broken dev-server state** (most likely) — it stopped serving `/src/*` after the earlier unbalanced-JSX crash.
2. **A stylesheet ordering issue** in `src/styles.css` that can fail the Tailwind v4 CSS build:

```text
1: @import "tailwindcss" source(none);
2: @source "../src";            <- non-import rule
3: @import "tw-animate-css";    <- @import AFTER a non-import rule
```

Tailwind v4 requires every `@import` to come before any other at-rule or selector. Line 3 violates that and can abort the CSS compile, which produces exactly this 404-instead-of-CSS symptom.

## Fix steps

1. Restart the dev server cleanly and wait for it to answer again.
2. Re-request `/src/styles.css` and re-run the browser check (`flex` must compute to `display: flex`, stylesheet must return CSS with a 200).
3. If the stylesheet still fails, reorder `src/styles.css` so both `@import` lines sit at the very top, with `@source "../src";` moved below them — no design tokens, colors, or rules changed.
4. Confirm the router is healthy again: `/` renders the Welcome page (not the 404 component), and spot-check a signed-in route so the layout is verified beyond the landing page.
5. Screenshot the homepage to visually confirm the layout is back to normal.

## Notes

- No design-system, component, or feature code is being changed. This is purely restoring CSS delivery.
- If the CSS compile turns out to be failing for a different reason (for example a rule accidentally introduced above the imports), the fix stays inside `src/styles.css` ordering only, and the exact error will be reported before any edit.
