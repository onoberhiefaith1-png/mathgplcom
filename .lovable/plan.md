# Replace the backend floating-number prompt with the new laws

## Scope (what gets touched)

Only the prompts that define **how an equation is broken into floating numbers**:

- `supabase/functions/notebook-ai/index.ts` → `mode: "floating"` system prompt (lines ~818–965)
- `supabase/functions/notebook-ai/index.ts` → `mode: "floating_highlights"` system prompt (lines ~1132–1169)

Everything else stays untouched:

- HARD RULE #1 (Unicode-only / no LaTeX / no `^{}`, `_{}`, `sqrt()`, `**`) — kept verbatim. This is the working "mathematical structure" prompt the user does not want broken.
- `INHERITANCE_STANDARD`, `VALIDATION_DIRECTIVE`, `integrityStandard`, `pedagogyReference`, `structuralStandard`, `renderingStandard`, `unicodeMath` — all kept as-is.
- All sanitisation code after the AI call (`hasTopLevelSign`, dirty-filler drop, leading-"+" strip, container dedup) — kept; it already enforces the new rules at runtime.
- Frontend extractor (`src/lib/smartboard/floatingExtractor.ts`) — already updated in prior turns; not touched here.

## The new laws being installed in the prompt

These replace the old HARD RULE #2 / transition rules / worked examples:

1. **No-Synthetic-Sign Rule** — a chip carries `+`, `−`, `×`, `÷` **only** when that sign is literally visible at that position in the source equation. First chip of a line, first chip after `=` / `±`, and first chip inside a bracket carry NO sign. Never invent a leading `+`.
2. **No-Hidden-Sign Rule (a±b is forbidden anywhere)** — if a container's body (bracket, fraction numerator/denominator, radicand, exponent, subscript, function argument) contains a top-level `+ − × ÷`, the container must be **opened**: emit the shell as its own chip and emit each interior term as its own chip with the correct visible sign. This applies recursively. `a+b` or `a−b` must never sit hidden inside any chip — coefficient, exponent, denominator, base, anything.
3. **Stay-Glued Rule (when no hidden sign and not too long)** — implicit multiplication (`ab`, `3x²`, `6ax`), radicals over a sign-free body (`√3`, `√75`), `log₂5`, `|x|`, `x²`, and `5/(3n)` stay as a single chip. A simple coefficient×variable like `3n` in a denominator stays attached.
4. **Length-Split Rule** — when an expression is unusually long even without a visible sign (e.g. `a²b²c²d²/d²a²b²a²`), split it using the same structural laws as a sign-bearing expression.
5. **Structure-Aware Containers** — emit one container tag per structural kind that appears (`fraction`, `bracket`, `radical`, `power`, `log`, `integral`, `matrix`, `differential`, `abs`, `vector`), deduped.
6. **Unicode-Only Output** — keep HARD RULE #1 verbatim; the structural-rendering work the user is happy with is preserved.

## Worked examples baked into the new prompt

The prompt will include the user's reference equation broken down the agreed way:

```text
x+1/4                      → [□/□, x, +1, 4]
+³√((x+2)^(n+1)/(x−4))     → [+√[3](), ()^(), x, +2, n, +1, x, −4]
−ⁿ√(n(n+1)²)               → [−√[n](), n, ()², n, +1]
+5/(3n)                    → [+□/□, 5, 3n]
−23/(4(n+2))               → [−□/□, 23, 4, (), n, +2]
−3n²(2x)^(n−4)             → [−3n², ()^(), 2x, n, −4]
```

Plus the simpler invariants:
```text
2x + 3y = 7            → ["2x","+3y","=","7"]
ax² + bx + c = 0       → ["ax²","+bx","+c","=","0"]
2x + 3(x+1) = 7        → ["2x","+3","(",x","+1","=","7"]
log₂(xy)               → ["log₂()","x","y"]    (xy has no hidden sign → stays glued inside)
log₂(x+y)              → ["log₂()","x","+y"]   (hidden + → open the log shell)
```

## Edits to make (build mode)

1. In `supabase/functions/notebook-ai/index.ts`, replace the `sys` string of `mode === "floating"` (≈ lines 818–965) with the new prompt: keep HARD RULE #1 word-for-word, replace HARD RULE #2 and the transition section with the six laws above, and replace the worked-examples block with the table above.
2. In the same file, update the `mode === "floating_highlights"` system prompt (≈ lines 1132–1169) so its "math highlight" bullet list mirrors the same six laws (one-liner each — the highlight prompt stays compact).
3. Do not touch the post-AI sanitiser block, the inheritance directive, or any other prompt.

## Verification

- `bunx vitest run src/test/floatingNumberLaws.test.ts` (existing 37 cases — must stay green; they already encode the new laws).
- Deploy the edge function and spot-check one extraction call from the smartboard to confirm no synthetic `+` and no hidden-sign chips come back.
