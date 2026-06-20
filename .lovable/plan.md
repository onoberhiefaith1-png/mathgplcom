# Plan: Guarantee Complete Floating-Number Generation

## Problem
Floating-number generation is inconsistent:
1. Sometimes nothing is produced.
2. Sometimes output is truncated mid-equation.
3. Sometimes generated chips drop symbols/terms that appear in the source question.

## Fix Strategy (three layers — prompt, transport, verification)

### 1. Strong AI prompt rewrite (`supabase/functions/notebook-ai/index.ts` — `floating` + `floating_highlights` branches)
- Add a non-negotiable directive block at the top of the system prompt:
  - "You MUST emit a JSON object for EVERY equation line in the source. Do NOT skip, summarise, paraphrase, or stop early."
  - "Before returning, internally re-scan the source question and confirm every variable, number, operator, function name, bracket pair, exponent, fraction, integral, and unit appears in your output. If any element is missing, regenerate."
  - "If you cannot fit all lines, prioritise completeness over commentary — drop prose, never drop equations."
- Add a worked example showing the completeness self-check.

### 2. Transport: prevent truncation
- Bump `max_tokens` / `maxOutputTokens` for the floating + floating_highlights calls (current default is too low for multi-line integrals).
  - Gemini path: `maxOutputTokens: 8192`.
  - OpenAI path: `max_tokens: 4096`.
- After the call, inspect `finish_reason` / `finishReason`. If `"length"` or `"MAX_TOKENS"`, log a warning and trigger one automatic retry with a tighter instruction ("return ONLY the JSON, no prose").
- If the response body is empty or not valid JSON, retry once before falling through.

### 3. Server-side completeness verifier (new `supabase/functions/notebook-ai/completenessVerifier.ts`)
- Extract an "element fingerprint" from the source question:
  - All identifiers (`x`, `ρ`, `C_v`, `tan⁻¹`, `dx`, `C`, …)
  - All numeric literals
  - All structural markers (∫, √, fraction bar, exponent, brackets, =, ±)
- Extract the same fingerprint from the concatenated generated equations.
- Compute `missing = source − generated`.
- Verifier returns `{ ok, missing[] }`.

### 4. Pipeline wiring (in `index.ts`)
Replace the current single-shot generation with this loop (max 2 attempts):
```
generate → finish_reason check → deterministicExtractLine →
  floatingVerifier (laws) → completenessVerifier (elements) →
    if any fail → retry once with failure list pasted into the prompt →
      if still failing → fall back to deterministic extraction of the
      source equation directly and mark `degraded: true`
```
This guarantees the UI always receives chips, even if the model misbehaves.

### 5. Observability
- Log every retry reason: `truncated`, `invalid_json`, `verifier:<code>`, `missing:<element>`.
- Log final outcome: `ok | degraded`.
- No new tables — logs only.

### 6. Tests (`src/test/floatingCompleteness.test.ts`)
- Source `∫ 1/(x²+4x+13) dx` → generated must contain `∫, 1, x, 2, 4, 13, dx`.
- Source with `ρ, C_v, k` → all three identifiers required.
- Truncated AI response simulation → pipeline retries → completes.
- Empty AI response → falls back to deterministic extractor on source, output non-empty.

## Untouched
- Five floating-number laws and their verifier.
- Deterministic extractor logic.
- Frontend rendering, DB schema, RLS, inheritance/integrity standards.

## Acceptance
- Every generation call returns a non-empty `fillers` list for every source line.
- No element present in the source question is missing from the output.
- Edge function logs show `ok` for valid inputs; `degraded` only when both attempts fail.
