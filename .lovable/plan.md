# Plan: Complex-Factor Split Rule + 10 Structure-Heavy Examples

## The refined law (what you just taught)

An implicit-multiplication run (no visible +, −, ×, ÷, =) stays as ONE floating chip **only if every factor in it is in *simple form***. The moment any factor carries a **coefficient, power, or subscript**, the run is split at that boundary.

**Simple form** = a bare letter, a bare number, or a bare function-of-a-bare-letter (e.g. `x`, `5`, `sinx`, `log₂b`, `lnx`).

**Not simple** = anything with a coefficient (`2x`, `3y`), a power (`x²`, `sin²θ`), a subscript (`x₁`, `aₙ`), or a complex function argument (`sin(2x)`, `log(x+1)`).

### Examples of the rule
| Expression | Chips | Why |
|---|---|---|
| `xsin2y` | `[ +xsin2y ]` | `x` simple, `sin2y` is one function unit → whole thing simple |
| `3x²sin2x` | `[ +3x² , +sin2x ]` | `3x²` has coefficient AND power → split before `sin2x` |
| `3x²sinx` | `[ +3x² , +sinx ]` | `3x²` not simple → split |
| `xsinx` | `[ +xsinx ]` | both factors simple → whole |
| `log_a(x²y)` | `[ +log_a() , +x² , +y ]` | argument contains non-simple `x²` → open the shell |
| `log_a(xy)` | `[ +log_a(xy) ]` | argument is product of simples → keep whole |
| `2xy` | `[ +2xy ]` | coefficient + two simple vars, no third factor → stays (this is the rule you gave earlier) |
| `2xyz` | `[ +2xy , +z ]` | (your earlier rule for 3-var case) |

So the splitter cascade is:

1. Top-level visible-sign split (already correct).
2. Inside a run of implicit multiplication, walk factor-by-factor; if any factor is "not simple" AND the run has ≥2 factors after combining the coefficient with the first variable group, cut between non-simple factor and the next factor.
3. Recurse into shells (`()`, `√()`, `log_a()`, `^()`, etc.) the same way.

## Code changes

Single source of truth: `src/lib/smartboard/floatingExtractor.ts`.

1. Add `isSimpleFactor(token)` helper:
   - true for: bare letter, bare number, bare-coefficient×bare-letter pair already merged (`2x`), `sin x` / `cos x` / `log_a x` / `ln x` where the argument is a single bare letter.
   - false for: anything containing `^`, `²`, `³`, `_`, `()`, `√`, `/`, or a numeric coefficient combined with anything that itself isn't simple.
2. After the existing implicit-multiplication tokenizer produces a factor list for a run, post-process:
   - If the run has only one factor → keep as one chip.
   - Else walk left→right; whenever the *current* factor is not simple, emit it as its own chip and start a fresh chip for the rest. Re-check the rest the same way.
3. Mirror the same logic on the server in `supabase/functions/notebook-ai/structuralStandard.ts` so the AI prompt teaches the new rule and the post-generation lock check accepts it.
4. Tests in `src/test/floatingNumberLaws.test.ts`:
   - `3x²sin2x` → `["+3x²","+sin2x"]`
   - `3x²sinx` → `["+3x²","+sinx"]`
   - `xsinx` → `["+xsinx"]`
   - `xsin2y` → `["+xsin2y]` (the `x` is simple, `sin2y` is one function unit)
   - `2xy` → `["+2xy"]`
   - `2xyz` → `["+2xy","+z"]`
   - `log_a(x²y)` → `["+log_a()","+x²","+y"]`
   - `log_a(xy)` → `["+log_a(xy)"]`

## Corrected version of example #1

`∫₀^π (3x²·sin(2x) + 5x) dx = K`
→ `[ ∫₀^π()dx , +3x² , +sin(2x) , +5x , = , K ]`

(Old version had `+3x²sin(2x)` as one chip — wrong under the new rule.)
Example #5 `log_a(x²y) = 2 log_a x + log_a y` becomes
→ `[ log_a() , +x² , +y , = , 2log_a x , + , log_a y ]`

## Then: 10 new STRUCTURE-HEAVY expressions

After the rule lands I'll present 10 new ones built around nested structures (fractions inside roots inside powers, matrices, integrals with limits as fractions, summations with fractional bounds, partial-fraction decompositions, vector/abs combos, piecewise, etc.) — for your review before any further code.

Say **go** to implement the rule + tests, or tell me to tweak the "simple form" definition first.