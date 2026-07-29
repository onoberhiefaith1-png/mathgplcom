# Smart Card as a public entry point into the existing engines

Two goals in this round:

1. Make MathGPL Life a separate product from Teaching Hub (shared engines, separate experience).
2. Rebuild Smart Card publishing so it reuses the existing Assignment → Dashboard → Student Smartboard flow instead of a private mini-system. Challenge mode only; Game Challenge (Adventure) comes next round.

## Part 1 — Separate the two products

Verified today: creating a Session inserts a real row into `classes`, and publishing a Smart Card creates a hidden "Smart Cards" holder class. The Teaching Hub class list selects every class the teacher owns with no filter, so both of these show up there as if they were real classes. The Session Dashboard tiles also link straight into `/teaching-hub/classes/...` pages.

Changes:

- Mark backing rows as non-classroom (additive `workspace` column on `classes`, default `classroom`; sessions and smart cards write `live`). Teaching Hub lists only `classroom`; Live lists only `live`.
- Give MathGPL Life its own routes under `/live/sessions/:sessionId/...` (audience, lesson notes, smartboard, challenges, game challenges, reports). They mount the same engines but with Live terminology and Live chrome — no more navigating into Teaching Hub pages.
- Teaching Hub keeps Assignment / Adventure / Class / Students wording and UI exactly as today. Nothing in Teaching Hub gains Smart Card, Challenge or leaderboard surfaces.

## Part 2 — Publish Through

The Smart Card Editor keeps its appearance-only tools (text size, emoji size, diagram size, colour, spacing; maths untouched). **Publish Smart Card** now asks:

```text
Publish through
  ( ) Challenge          → existing Assignment engine, no classroom
  ( ) Game Challenge     → existing Adventure engine (next round, shown disabled)
```

Publishing keeps snapshotting the question so later lesson-note edits never change a live card.

## Part 3 — Challenge Dashboard

The published card link opens a Challenge Dashboard rebuilt from the Assignment Dashboard layout, with classroom information replaced:

- Header: Challenge Title, Topic, Subtopic, Difficulty, Total Marks, Published By.
- Stats: Total Players (was Total Students), Perfect Scores (was Completed), Visitors (was Inactive), plus a new Currently Solving.
- The published Smart Card is shown at the top exactly as designed — displayed, never regenerated.

Identity block on the same page:

- First-time visitor: "Choose a Username" + Continue (mandatory).
- "Already have a Smart Challenge profile? Sign In" — stores username + email for Smart Challenges only; it does not sign anyone into MathGPL.
- Returning visitor: "Welcome back, <name>" + Continue, no username prompt.

Then one large **▶ Start Challenge** button.

## Part 4 — Solving and results

Start Challenge opens the existing Student Smartboard — the same one used for classroom assignments — with Floating Numbers, Check, Reasoning, AI marking, timer, marks and progress unchanged. Only the scope changes from class/student to challenge/player.

On completion, the existing completion flow shows Score, Percentage, Time, Position, Personal Best and Leaderboard Position, with **Try Again** reopening the same board. Leaderboard rule stays: only 100% qualifies, ranked by fastest time, earlier qualifying runs preserved.

## Part 5 — Preview

**Preview Smart Card** in the editor walks the teacher through the identical public path: Challenge Dashboard → username/sign-in → Start Challenge → Smartboard → Results → Leaderboard. Preview runs are flagged so they never enter the public leaderboard or player counts.

## Technical notes

- `classes.workspace` added by an additive migration with a default, so existing rows stay `classroom`; queries in Teaching Hub and Live filter on it.
- Challenge participation stays account-free through the existing `smart-card` edge function: it serves the card + assessment payload by slug, records attempts, and returns dashboard counters (players, perfect scores, visitors, currently solving). `smart_card_attempts` gains additive columns for visit/active heartbeat and a preview flag; grading continues through `grade-line` with `smartCardSlug`.
- The challenge board mounts the existing `PresentationView` with a Smart Card board scope (`buildBoardScope`) instead of a class/assessment scope, so board isolation rules already in place apply unchanged.
- Smart Challenge profiles are stored separately from platform auth (local identity + a Smart Challenge profile record keyed by email), never touching Supabase auth sessions.
- New Live pages live under `src/pages/live/**`; no Teaching Hub page is edited beyond the class-list filter.
