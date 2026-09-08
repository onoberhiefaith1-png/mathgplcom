# Sign out means sign out

Today, when one person signs out and another signs in on the same device, the app can still show the first person's name, dashboard and lists until the page is refreshed. That is a privacy fault, and this plan closes it.

Two things cause it:

1. Signing out clears the sign-in itself, but not the information the app is already holding in memory (role, workspace, name, background, lists). The next person inherits that held information until a refresh replaces it.
2. Nothing checks that the person now signed in is the same person the held information belongs to.

## What changes

- Signing out wipes everything the app is holding about that person, in one place, before anyone else can sign in.
- Signing in as a different person also wipes anything left over — so even a crash, a closed tab or a stale page cannot leak the previous account.
- While that wipe happens, the app shows a brief "Signing out…" state instead of the old account's screens, so nothing from the previous person is ever on screen.
- Every "Sign out" button in the app (account menu, top bar, home page) goes through the same routine, so none of them can forget a step.
- After signing out, the person lands on the login page and the Back button cannot return them to the previous account's pages.

## Closing the browser

You also said: if someone just leaves the page, they are out. There is a "Remember me" tick box on the login form today. Proposed behaviour: with it ticked, the sign-in survives closing the browser (as now); unticked, closing the browser or tab ends it and the next visit requires a fresh sign-in. If you would rather every sign-in end when the browser closes, with no option, say so and I will drop the tick box.
