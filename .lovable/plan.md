## Goal

Stop the correction cycle. Floating numbers must come out of the backend **already correct against the five laws** — no chip is ever returned to the UI unless a mechanical verifier has proven it satisfies every law.

## Strategy: deterministic generator + verifier, AI only as a fallback

The AI is the wrong tool to do the splitting — it keeps inventing `+`, leaving `(` as a chip, missing hidden signs. Splitting an equation into chips is a **structural** operation; it can be done deterministically from the Unicode equation string. So the new pipeline is:

```
                   ┌─ Deterministic extractor (primary) ─┐
ACTIVE_QUESTION ──►│  parse → tree → chips per the laws  │──► verifier ──► UI
+ SOLUTION lines   └──────────────────────────────────────┘        ▲
                                                                   │
                          AI extractor (fallback, retried up to 2× with
                          verifier feedback) ─────────────────────►┘
```

The verifier is the single source of truth. If chips fail any law it either re-runs the deterministic extractor in strict mode or asks AI to retry with the exact failures pasted into the prompt. The function never returns unverified chips.

## What gets built

### 1. New file `supabase/functions/notebook-ai/floatingExtractor.ts`

A self-contained, deterministic chip extractor that runs on the edge. It mirrors the laws exactly:

- **Tokeniser** — walks the Unicode equation, tracking bracket / `\frac{}{}` / `\sqrt{}` / `^{}` / `_{}` / `log_{}()` / `|...|` depth. Emits a structural tree (sign-leaf, container-node).
- **Law 2 detector** — `hasHiddenArithmetic(body)` scans a container body, ignoring leading sign and skipping nested containers, returns true if it finds a top-level `+ − × ÷`.
- **Chip emitter** — for each container:
  - If body has hidden arithmetic → emit shell chip (`"()"`, `"□/□"`, `"√()"`, `"√[n]()"`, `"()^()"`, `"log₂()"`, `"|()|"`, …) then recurse on every interior term.
  - Else → keep glued as one chip (Law 3) unless Law 4 length-split fires (configurable threshold, default ~14 chars of raw factors).
- **Sign attachment** — every chip after the first content chip keeps its visible sign. First chip of line, chip after `=`/`±`, first chip inside any opened container is bare. No `+` ever invented.
- **Container collector** — deduped list using the canonical 10 kinds.

Output shape per line is the same `{ equation, fillers[], containers[] }` already consumed by the UI.

### 2. New file `supabase/functions/notebook-ai/floatingVerifier.ts`

Hard verifier with these checks. Every check returns a structured failure that can be (a) printed into an AI retry prompt or (b) thrown as 422 to the client.

| Check | Rule violated if … |
| --- | --- |
| `NoRawOperatorChip` | A chip is exactly `"+"`, `"−"`, `"×"`, `"÷"`, `"/"`, `"*"`. |
| `NoRawBracketChip` | A chip is exactly `"("` or `")"` (must be `"()"` shell). |
| `NoSyntheticLeadingPlus` | First content chip starts with `+`, or chip after `=`/`±` starts with `+`. |
| `NoHiddenSign` | Any chip body (stripped of leading sign) contains a top-level `+ − × ÷` outside a shell. |
| `ShellPresent` | An opened container in the equation has no shell chip in `fillers` (e.g. fraction in eq but no `□/□`). |
| `ContainerAllowed` | Containers ⊆ the canonical 10. |
| `ContainerDedup` | No duplicate container kinds. |
| `EquationTraceable` | Every chip's non-sign body is a substring (after normalisation) of the equation, or is a known shell. Prevents AI from inventing values. |
| `LawCoverageMatch` (soft) | Compare against the deterministic extractor's output — if AI's chips differ structurally, prefer the deterministic version. |

### 3. Pipeline change in `supabase/functions/notebook-ai/index.ts`

In `mode === "floating"` and `mode === "floating_highlights"`:

```text
1. Run deterministicExtract(equation) for every line / highlight.
2. Run verifier on deterministic output.
   ├─ PASS  → return it. (This is the happy path; AI is skipped.)
   └─ FAIL  → fall through to AI (rare: only for prose-only highlights,
              or expressions the deterministic parser refuses).
3. AI call → verifier.
   ├─ PASS  → return.
   └─ FAIL  → retry AI ONCE with the verifier failure list pasted in.
              If still failing, fall back to deterministic output even
              if it's partial, and tag the response with `degraded: true`.
4. Never return unverified chips.
```

Logs include `[floating] verifier failures: [...]` so future regressions are visible in edge-function logs.

### 4. Drop redundant client-side transforms in `src/pages/FloatingNumbersPage.tsx`

Now that the backend guarantees correctness, the client no longer needs to:
- run `sanitizeFillers` to pull macros out,
- run `dropContextualLeadingPlus`,
- run the pairwise `expandTransitionLine` pass.

These are kept in the file as dead code only if useful for legacy data; the active path uses chips as-is from the backend. The `arrangement` is still computed client-side.

### 5. Regression tests

Add `supabase/functions/notebook-ai/__tests__/floatingExtractor.test.ts` (run via `bunx vitest run` against the file directly — it has no Deno-only imports). Cover every worked example in the prompt verbatim:

```text
2x+3y=7              → ["2x","+3y","=","7"]                         []
3x−2y=0              → ["3x","−2y","=","0"]                         []
ax²+bx+c=0           → ["ax²","+bx","+c","=","0"]                   ["power"]
2x+3(x+1)=7          → ["2x","+3","()","x","+1","=","7"]            ["bracket"]
√(b²−4ac)            → ["√()","b²","−4ac"]                          ["radical","power"]
log₂(xy)             → ["log₂()","xy"]                              ["log"]
log₂(x+y)            → ["log₂()","x","+y"]                          ["log"]
5/(3n)               → ["□/□","5","3n"]                             ["fraction"]
−23/(4(n+2))         → ["−□/□","23","4","()","n","+2"]              ["fraction","bracket"]
−3n²(2x)^(n−4)       → ["−3n²","()^()","2x","n","−4"]               ["power","bracket"]
+³√((x+2)^(n+1)/(x−4)) → ["+√[3]()","□/□","()^()","x","+2","n","+1","x","−4"]
                                                       ["radical","fraction","power","bracket"]
−ⁿ√(n(n+1)²)         → ["−√[n]()","n","()²","n","+1"]               ["radical","power","bracket"]

# User's screenshot equation:
(x²+2x+1)/((x²+1)(x+1)) = A/(x+1) + (Bx+C)/(x²+1)
→ ["□/□","x²","+2x","+1","(","x²","+1",")","(","x","+1",")",       # numerator stays glued, denom opens
   "=","□/□","A","(","x","+1",")",
   "+□/□","(","Bx","+C",")","(","x²","+1",")"]
```

(Exact expected chips will be encoded as Unicode strings in the test fixtures. The verifier runs on each expected output too — it must pass for all of them, otherwise the rules themselves are inconsistent and need refining before code lands.)

### 6. Verifier also runs in build CI

The new `floatingVerifier` is exported so the existing frontend test suite `src/test/floatingNumberLaws.test.ts` can import and assert it. This means a future regression on the frontend extractor (still used for instant pre-AI previews) is caught too.

## What is NOT touched

- HARD RULE #1 (Unicode-only) — kept verbatim.
- `INHERITANCE_STANDARD`, `VALIDATION_DIRECTIVE`, `integrityStandard`, `pedagogyReference`, `structuralStandard`, `renderingStandard`, `unicodeMath` — untouched.
- DB schema, RLS, storage — untouched.
- Notebook renderer (`\frac{a}{b}` in the equation field still rendered as stacked fraction).

## Verification before declaring done

1. `bunx vitest run` — new extractor + verifier suites must all be green (≈ 50 cases).
2. Deploy edge function, then hit `/lesson-notes/.../floating/...` → Generate. Confirm:
   - No chip is bare `/`, `(`, `)`, or `+`.
   - Every fraction has a `□/□` chip.
   - Every bracket with hidden sign has an `()` chip and opens its interior.
   - No synthetic leading `+`.
   - User's screenshot equation produces the chip list above.
3. Inspect `notebook-ai` edge-function logs — they should show `verifier: pass` for each line.
