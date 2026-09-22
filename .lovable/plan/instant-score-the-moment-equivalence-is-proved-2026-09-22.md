# Instant score the moment equivalence is proved

## What I found (checked in the running app)

- The Game panel's "Score pending / Equivalent detected" is real: on a student board the mark cannot be decided on the device, because **the answer key is deliberately never sent to the device** in assessment mode. I traced a live line: the board only receives the shuffled floating pieces (`+7 | 12 | x | =`) and an empty expected line, so the predictive engine has no destination to prove against and the mark still waits for the marking service round trip.
- The Predictive Line engine itself is correct: given the expected line it proves `x + 7 = 12`, `12 = x + 7` and `7 + x = 12` instantly and in memory, and rejects `x + 12 = 7`.
- Vault stays exact-order and never awards a mark; that is unchanged.

So the only thing standing between "equivalence detected" and "score awarded" is that the device is not allowed to know the expected line.

## The fix: a route seal

When a line becomes active (before the student finishes), the board asks the marking service once for that line's **route seal** — a small set of salted fingerprints of the expected line's canonical mathematical form, plus the line's marks. A fingerprint cannot be read backwards, so the answer stays hidden, exactly as today.

Then, on every placement or keystroke:

1. The engine canonicalises what the student has written, locally.
2. It fingerprints that canonical form with the same salt.
3. Match → the line is complete, equivalent is proved, and **the mark is awarded on that same tick**, with no request and no pending state.
4. No match → the predictive route is recalculated and shown as today.

The marking service still runs in the background as the authority and reconciles the record; if it ever disagrees its verdict wins.

## Both surfaces

- **Platform (Smartboard / assignments):** identical screen and behaviour, but the mark and the running total appear the instant the final symbol lands.
- **Game:** the same award event, so score, completion coin, notes and line rewards all fire immediately. The Game Evaluation panel then shows "Awarded" with no pending step; "Equivalent detected / Score pending" becomes a genuine warning that should never normally appear.
- Teacher test play already knows its own expected line, so it proves locally with no seal request at all.

## Safeguards kept

- A mark is never awarded without proved equivalence; an incomplete line (for example `x + 7` on its own) still earns nothing.
- Vault opening never awards the mark.
- One marking authority, one active line, one mathematics engine — no second grader.

## Technical notes

- New line-seal endpoint on the existing marking service: returns `{ lineId, marks, salt, fingerprints[] }` for the active line; fingerprints are SHA-256 of the canonical form (both equation orientations) with a per-assessment salt. No expected text leaves the server.
- `src/lib/predictive/predictiveLine.ts` gains a seal mode: `provesEquivalent` can be satisfied either by a known expected line (test play) or by a fingerprint match (student mode). No new mathematics, no second engine.
- `PresentationView.tsx` prefetches the seal when the active line changes and caches it per `questionId:lineId`; `awardIfPredictivelyComplete` then works in both modes and keeps the existing award path (`lastAwardedExpression`, `confirmLine`, broadcast).
- Route prediction display in the Game continues to use the teacher's configured line; the student board never receives it.
- Tests: seal match awards instantly, wrong-but-similar line awards nothing, incomplete fragment awards nothing, reordered equivalent line awards, Vault order unchanged, plus a live pass building a line piece by piece and checking the total moves on the final piece.
