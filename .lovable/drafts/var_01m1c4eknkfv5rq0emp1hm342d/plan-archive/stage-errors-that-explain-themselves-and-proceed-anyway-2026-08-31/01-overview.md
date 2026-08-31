# Stage errors that explain themselves — and "Proceed anyway"

## The problem

At the final stage the mix refused to build and only flashed a message ("4 segments still overflow their original clip — fix them in Stage 7 first"). Nothing was stated on the page, nothing rendered, and there was no way to say "I accept that — carry on".

Those checks currently live inside the actions themselves: they show a toast, stop, and leave no trace. Stage buttons are also disabled without saying why, so a greyed-out "Approve & Continue" explains nothing.

## What changes

Every stage gets the same two things:

1. **The error is stated on the stage, in plain words** — a panel inside the stage listing each problem, how many segments it affects and which ones. It stays visible until it is resolved or overridden, instead of vanishing with a toast.
2. **A "Proceed anyway" button next to it** — it records your decision for that stage and immediately runs the action you were blocked from (build the mix, render, approve, continue). The stage then counts as passed and is not asked again unless the content behind it changes.

Nothing is silently disabled any more: if a stage cannot continue, it says why and offers Proceed anyway.
