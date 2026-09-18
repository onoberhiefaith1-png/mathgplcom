# Floating Numbers ↔ Game Slate: one connected mathematical game

The mathematics stays where it already lives (Floating Numbers). The Game Slate stays the
physical world. They are joined by one shared line identity, and the exercise is the source
of truth for how many writing surfaces the Game has.

Nothing is rebuilt: no second math engine, no second marking system, no second currency,
no redesign of the slate.

## What already works today (verified)

- Each Game question is a Floating Numbers question compiled into a hidden board, carrying
  line ids, per-line marks, per-line notes, the question timer and per-line timers.
- At play time the slate is already built as Line 0 (read-only question) plus one line per
  Floating Numbers line; the student's live working is engraved on those lines.
- Line selection is single-sourced: tapping a writing surface sets the active line, and the
  Floating Numbers panel follows it.
- Line timers already come from Floating Numbers and already start on first engagement.

So the remaining work is the editor side, the reward semantics, and reward targeting.

## Stage 1 — The exercise decides the surfaces (editor)

- Attaching an exercise reads its line count and builds exactly that many writing surfaces,
  plus Line 0. 5 lines → 5 surfaces; 100 lines → 100 surfaces.
- The manual surface count stops being the structure. It is kept only as the repeating
  *appearance/reward pattern* the surfaces inherit from, and is labelled as such.
- Every surface is stored against its Floating Numbers `lineId` — one numbering, never two.
- Re-attaching or editing the exercise: surfaces with surviving line ids keep their style,
  vault and rewards; new lines get surfaces; removed lines lose theirs. Game-level rewards
  are untouched.

## Stage 2 — Line-aware editor preview

- Selecting a writing surface in the Game editor shows that line's real mathematical
  content on the chosen material, so the teacher sees Line 3 on Parchment before saving.
- This is preview only: the teacher edits mathematics in Floating Numbers, never here.
- Surfaces use the adaptive writing surface already built, so the panel grows with the
  expression.

## Stage 3 — Hourglass becomes derived, not placed

- Remove the Hourglass/Time reward from the generic reward palette.
- A line with a Floating Numbers line timer automatically has an Hourglass on its surface;
  a line without one has none.
- The reward amount becomes a configurable multiplier of that line's own timer
  (Full / Half / Third / Quarter, or a chosen fraction) — never a hardcoded 30 seconds.
  2:00 line at a quarter gives 30s; 10:00 line at a quarter gives 2:30.
- Completing the line in time awards that time to the question clock. Expiring simply
  dissolves the Hourglass: no reward, no penalty, the line and question continue.
- The overall question timer and line timers stay separate in data and in the HUD.

## Stage 4 — Vault becomes line-specific and mathematical

- Remove the Vault from the generic reward palette; it is configured per line.
- The teacher enters the expected method as mathematics using the existing Floating Numbers
  input (for example `x + 7` on Line 1, `2x + 6` on Line 2), stored structurally.
- During play, the student's work on that line is checked against the vault expression using
  the existing mathematical equivalence engine — never string comparison.
- A match opens the Vault with its existing animation and releases its reward into the
  existing coin currency. A correct answer by another method still marks, but does not open
  the Vault.
- The old "fraction, bracket…" field in that region is retired and replaced by the Vault
  expression input.

## Stage 5 — Life and overall time

- Life stays a normal placed Game reward; completing its line grants the life.
- The continuation time a life grants becomes a configurable fraction of the original
  question time (Full / Half / Third / Quarter). 10:00 at a third gives 3:20.
- On question-time expiry the existing flow is kept: consume a life, grant the configured
  continuation time, completed lines stay completed; no lives left → existing failure reset.

## Stage 6 — Rewards become world-based

- Every reward carries its world position, line id, type, active and visible state.
- Vertical Collector sweeps its column, Horizontal Collector its row, both by world
  coordinates — never by screen/DOM guesses.
- Premium Bomb targets only rewards actually visible in the camera view, so a 50-line game
  showing lines 1–5 never detonates line 40. It may trigger collectors, lives and other
  visible rewards, but never an Hourglass and never another Premium Bomb.
- Fox keeps its existing behaviour and is recognised by the reward system unchanged.
- Off-screen sections stay inactive for interaction while scrolling.

## Technical notes

- Shared key everywhere is the Floating Numbers `lineId`; Game Line N = `lineIds[N-1]`.
- Surfaces move from index-addressed slots to line-addressed records
  (`lineId`, surface style/material, bounds, vault config, reward config, world position);
  the repeating pattern remains the default source of appearance and placed rewards.
- Hourglass and Vault leave the reward palette and become derived/line-scoped configuration;
  runtime reward maps replace the current hardcoded coin/life/second values with the
  configured multipliers.
- Vault matching reuses the existing equivalence utilities; no new checker.
- Migration adds line-keyed surface/vault/reward configuration to the saved game and the
  per-line reward multipliers, and back-fills existing games from their pattern slots.

## Out of scope

Floating Numbers authoring, marking and AI evaluation stay exactly as they are. Classes,
assignments, reports and Adventure keep their current behaviour; the Game only reads and
writes its own world state and existing results.
