# Fix Requests page back navigation

## Problem
The Requests page back button currently reads **“Back to my building”** and links to `/` (the rotating building homepage). The user actually reaches Requests from their role-specific Dashboard, so the label and target are wrong.

## Goal
Change the back button to **“← Back to Dashboard”** and route the user to the Dashboard they came from — without touching any other Requests functionality or layout.

## Scope
- Only `src/pages/connections/RequestsPage.tsx` is changed.
- Tabs, filters, connection rows, dialogs, loading/empty states, and styling remain untouched.

## Proposed change
1. Import `useAccount` and `WORKSPACE_PATH`.
2. Read the current account role.
3. Replace the static `Link to="/"` with `Link to={WORKSPACE_PATH[role] ?? "/"}`.
4. Replace the visible text **“Back to my building”** with **“Back to Dashboard”**.

## Role-specific destinations
| Role | Dashboard path |
|------|----------------|
| platform_owner / co_admin | `/admin` |
| school | `/school` |
| teacher | `/teaching-hub` |
| parent | `/family` |
| student | `/student` |

## Verification
- Typecheck passes (`bunx tsgo --noEmit`).
- Open `/requests` and confirm the back button label changed and it navigates to the correct dashboard for the active role.
