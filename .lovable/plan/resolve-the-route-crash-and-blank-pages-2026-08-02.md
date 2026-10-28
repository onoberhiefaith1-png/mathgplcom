# Resolve the route crash and blank pages

## Confirmed diagnosis

- The newest development-server output reports router initialization failures for duplicate route IDs, including `/` and `/lesson-notes/`. When router startup fails, `/signup`, `/login`, `/mathboard`, and other lazy route chunks cannot initialize and the root error page appears.
- The route source files themselves define the expected parent/index structure; the collision is occurring while the generated route tree is initialized.
- The installed TanStack packages are not on one compatible release set: React Router resolves to `1.170.18`, Router Core to `1.171.15`, the route generator to `1.167.21`, and the explicitly listed Router Plugin to `1.168.23`. This mixed generator/runtime stack is the likely source of the intermittent malformed route tree during regeneration/HMR.
- Missing hashed files such as `signup-DUoXBb1B.js` are a secondary symptom: the browser requests an old route chunk after the router/build has changed.

## Repair

1. **Stabilize route generation**
   - Remove the redundant direct Router Plugin dependency because the project’s TanStack Start Vite configuration already supplies the router generator.
   - Align the remaining TanStack Start/Router packages to a mutually compatible release set and refresh the dependency lock.
   - Let the official generator recreate the route tree from `src/routes`; do not hand-edit the generated file.

2. **Protect users from stale route chunks**
   - Add one-time recovery for genuine dynamic-import/chunk-version failures: refresh the application once to obtain the current asset manifest, while preventing a reload loop.
   - Keep ordinary application errors in the existing error boundary and make **Try again** rerun route loading without hiding the original failure.

3. **Verify the full entry flow**
   - Confirm fresh and client-side navigation for `/`, `/signup`, `/login`, `/auth/accept-invite`, and `/mathboard`.
   - Verify Back navigation and authentication restoration still work after the router stabilization.
   - Check that server output contains no duplicate-route invariant, each route returns 200, route chunks load successfully, and the browser has no blank screen or console error.

## Technical scope

Files expected to change: `package.json`, the dependency lockfile, router-level chunk recovery/error-boundary code, and only route source files if regeneration exposes a genuine filename/path mismatch. No database or feature behavior changes.
