# Predictive Line Engine — one shared route engine for Smartboard and Game

## What exists today (checked)

- The mark is decided by the backend marking service (`supabase/functions/_shared/mathEquivalence.ts`): structural match → symbolic → numeric sampling → AI. Every line award waits for that round trip, which is the delay you see.
- The board already grades proactively while a line is active (60 ms coalesce, stale answers discarded), so the waiting is the request itself, not the trigger.
- A fast local equivalence engine already exists in the app: exact-fraction canonical forms (`src/lib/smartboard/canonical.ts`, `polyCanonical.ts`, `equationsEquivalent`). It proves equal/not-equal for linear and polynomial equations in memory, with no network call.
- Vault matching is exact-sequence and completely separate (`vaultMatches`), and the Game Evaluation panel already reads Expected line / Student line / status.

So the Predictive Line is built by promoting the existing local canonical engine into a shared route engine — no new mathematics.

## The engine

New shared module, used by both surfaces, no UI ownership:

1. **Route map (precomputed).** When the question, line, Floating Numbers or teacher configuration changes, build once: the target canonical form of the Expected Line, and the finite multiset of Floating Number atoms available on that line. Cached per line.
2. **Follow the student.** On every placement/keystroke, canonicalise the Student Line locally and compare with the target.
   - Proved equivalent → the line is complete the moment the last symbol lands.
   - Not yet complete → search the remaining atoms for the shortest arrangement that reaches the target, restricted to the Floating Numbers that actually exist. Bounded search (small breadth/depth budget, deterministic tie-break) so it stays instant; grouped Floating Numbers naturally shrink the search.
   - Result: `PREDICTIVE = student construction + shortest valid remaining route`, recalculated from the student's new position whenever they change direction.
3. **No valid route.** When the search exhausts the available atoms without reaching the target, report `NO VALID ROUTE` instead of inventing predictions.
4. **Keyboard fallback (desktop).** Floating Numbers are the primary route. Only when they cannot produce a valid route does the engine evaluate freely typed mathematics through the same local canonical check. Mobile stays Floating-Number only.

## Instant marks

- When the local engine **proves** equivalence, the line completes and the mark is awarded immediately — no second calculation at completion.
- The backend marking service stays the authority and still runs in the background for the record and for anything the local engine cannot prove (structured maths, unusual forms, AI cases). If it ever disagrees, its verdict wins and the line is corrected.
- The completeness rule is preserved locally: when the expected line is an equation, a one-sided fragment such as `x + 7` can never complete the line. Vault activation still awards nothing.

## Surfaces

- **Smartboard:** same UI, same evaluation information, same controls — it simply gets its verdict from the local engine first, so marks land without waiting.
- **Game Evaluation panel:** gains a third row, `PREDICTIVE LINE`, under Expected and Student, plus `NO VALID ROUTE` when applicable. Rewards, Vault, Hourglass, Life, Bomb, Completion Coin, resources and the event feed stay exactly as they are and remain independent of the mark.

## Technical notes

- New `src/lib/predictive/predictiveLine.ts` (pure, unit tested): `buildRouteMap({ expectedAscii, atoms })`, `predict({ routeMap, studentAscii })` → `{ status: 'incomplete' | 'complete' | 'no_route', predictiveAscii, remaining }`. Reuses `polyCanonical`/`canonical` and a client copy of the complete-equation-shape guard; no second equivalence implementation.
- `PresentationView.tsx` calls `predict` on the existing proactive-grading tick; a `complete` result awards through the current award path (`lastAwardedLineId` + exact awarded expression) while the existing `grade-line` request continues in the background and reconciles.
- `src/lib/game/inspector.ts` accepts the predictive result and exposes it in `LineReport`; `GameEvaluationPanel.tsx` renders the extra row. The Game still never grades — it consumes the same award events.
- Route map cached by `questionId:lineId:atomsFingerprint`; search bounded by node and depth limits with a deterministic ordering so equal-length routes are stable.
- Tests: route following (`x` → `x + 7 = 12`, `7` → `7 + x = 12`, `12` → `12 = x + 7`), partial restore (`11 = 2(x + 3) − 4x + 5` → `+ 2x`), `x + 12 = 7` rejected early, no-route case, grouped vs separated Floating Numbers, fragment never completes an equation line, Vault order unchanged. Then a live pass on the saved room Game confirming the mark lands on the final symbol with no visible wait.

## Not changing

Smartboard UI and functionality, Assignment/Student Dashboard evaluation, Floating Numbers generation, Vault exact-sequence logic, reward conditions and conversion, rooms, camera, saved teacher design.
