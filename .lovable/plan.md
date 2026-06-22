# Floating Numbers Engine — Reasoning, Verification & Law Discovery

## Goal
Convert the Floating Number Generation Page from a one‑click generator into a **reasoning + verification + law‑discovery** system. No floating chip set may be approved unless **every element of the original equation** is accounted for and the equation can be **reconstructed exactly**.

## Pipeline (per equation line)

```text
Highlight → Generation Page → [Generate]
   → Reasoning Page  (Element Detection → Law Detection → Law Application → Proposed Floating Numbers)
   → Verification Page  (Coverage Check → Reconstruction Test → PASS/FAIL)
   → Teacher: Approve | Regenerate | Restructure
   → (on Approve) Law Discovery  (Draft Law Proposal → Approve | Edit | Reject)
   → Back to Generation Page (line marked ✓)
```

Approve is **disabled** until Coverage = 100% AND Reconstruction = exact match.

## What we build

### 1. Element Detector (`src/lib/floating/elementDetector.ts`)
Tokenises the original highlight into a typed inventory:
`number | variable | operator(+,−,×,÷,=,≠,<,>,≤,≥,±) | bracket(open/close pair) | fraction(num,den) | radical(index?,radicand) | power(base,exp) | subscript(base,sub) | integral(lo,hi,body,dvar) | summation | matrix | text | function-name`.
Produces an ordered element list **and** a multiset fingerprint (counts per element). Used as the ground truth on both Reasoning and Verification pages.

### 2. Law Engine (`src/lib/floating/laws/`)
Each law is a small pure module: `{ id, name, version, detect(elements), apply(elements) → { transforms, scaffolds, explanation } }`. Initial seed = the 18 laws already described (Visible Blade, Clean/Dirty Argument, Dictionary Gate, Exponent Ecosystem, Subscript Collision, Fraction Scaffold, Function Gate, Text/Let, etc.). `runLawPipeline(elements)` returns: applied laws (with reason text), the proposed chip array, and the scaffold list.

### 3. Verification Engine (`src/lib/floating/verifier.ts`)
- **Coverage check**: every entry in the original fingerprint must appear in the generated chips' fingerprint (counts must match; scaffolds count as their structural element).
- **Reconstruction test**: a deterministic `reconstruct(chips, scaffolds) → string` that re-assembles chips into a normalised canonical form, compared to the normalised original (whitespace + unicode/ascii equivalents folded; e.g. `−` ≡ `-`, `×` ≡ `*`).
- Returns `{ coverage:%, missing:[], extra:[], reconstructed, original, exactMatch:boolean, status:'PASS'|'FAIL' }`.

Reuses the spirit of the existing `completenessVerifier.ts` but is structure-aware (not just identifier/number fingerprints) and adds the reconstruction step.

### 4. Reasoning Page (`src/pages/floating/ReasoningPage.tsx`)
Read-only walkthrough rendered from the Law Engine output:
- Step 1 Original Equation
- Step 2 Detected Elements (numbered list + total)
- Step 3 Applicable Laws (✓/✗ with reason)
- Step 4 Law Application (one card per law: Reason / Action / Result)
- Step 5 Proposed Floating Numbers (chip preview)
Buttons: **Continue to Verification**, **Regenerate**, **Restructure**.

### 5. Verification Page (`src/pages/floating/VerificationPage.tsx`)
Two columns: Original Elements vs Generated Elements, each with ✓/✗. Coverage bar (e.g. `5/7 — 71%`). Reconstruction diff panel. **Approve** button enabled only when `status==='PASS' && exactMatch`. On FAIL: red banner with explicit `Missing: variable b, minus operator`.

### 6. Restructure Panel
Inputs supported on both Reasoning and Verification pages: typed instruction, screenshot upload, document upload, voice note, chip-region highlight, free-text comments. Payload is sent to the edge function with a `scope` field so the AI only re-reasons the selected region; untouched chips are preserved.

### 7. Law Discovery (`src/lib/floating/lawDiscovery.ts` + UI block on Verification Page)
After teacher Approve, diff `(beforeChips, afterChips, lawTrace)`. If the teacher's correction is not explainable by any existing law, generate a **Draft Law Proposal**: `{ name, reason, rule, conditions, exceptions, examples[] }`. Render under the approved result in a "Pending Law" card with **Approve Law / Edit Law / Reject Law**. Approval assigns the next `law_number` and writes to the Law Library; rejection stores the correction as historical evidence only.

### 8. Persistence (Lovable Cloud)
New tables (all with GRANTs + RLS scoped by `owner_id = auth.uid()`):
- `floating_generations` — per equation line: original, elements_json, law_trace_json, chips_json, verification_json, status (`pending|approved|rejected`), notebook_id, line_id.
- `floating_law_library` — approved laws: `law_number, name, rule, conditions_json, exceptions_json, examples_json, source_generation_id, approved_at`.
- `floating_law_drafts` — proposals awaiting teacher decision: same shape + `status (pending|approved|rejected)`.
- `floating_restructure_events` — audit trail of restructure inputs (text/voice/screenshot refs in `reference-images` bucket).

### 9. Edge function (`supabase/functions/notebook-ai/floating-reason/index.ts`)
New action `mode: 'reason'` that returns `{elements, laws, chips, scaffolds, explanation}`. Server **re-runs the Verification Engine** before responding; if PASS fails, it retries up to 2× with stricter prompt, then returns the failing trace so the UI can show it (never silently drops elements). Reuses `unicodeMath`, `floatingExtractor`, `completenessVerifier`.

### 10. Generation Page integration
- "Generate" no longer commits chips. It opens Reasoning Page for that line.
- Lines display a status badge: `Not generated | Reasoning | Verified ✓ | Failed ✗`.
- Only `Verified ✓` lines feed the downstream Smartboard/Floating workspace.

## Technical notes
- Pure TypeScript modules for detector/laws/verifier so they run identically in browser preview and in the edge function (shared via the existing `supabase/functions/notebook-ai/*.ts` mirror pattern).
- Canonical normaliser: collapse whitespace, fold unicode operators to ascii, normalise implicit multiplication, sort commutative scaffold contents only for fingerprinting (never for reconstruction).
- Tests (`src/test/floatingVerifier.test.ts`, `floatingLawEngine.test.ts`):
  - `4(a-b)=0` → 7 elements, PASS, reconstruct exact.
  - Missing `b` → coverage 6/7, FAIL, Approve disabled.
  - `e^{2x+1}=10` → triggers Visible Blade + Scaffold Isolation + Dirty Exponent; reconstruction PASS.
  - `f(x)` stays fused; `a(b+c)` fractures.
  - `x_1` fuses; `x_{n+1}` shells.

## Out of scope (this plan)
- Changing the Highlighting Page or Lesson Notes flow.
- Touching Smartboard rendering or the Floating Workspace itself — they keep consuming approved chip arrays as today.
- Auto-approving laws; every new law requires explicit teacher approval.

## Files to create / change
- New: `src/lib/floating/{elementDetector,verifier,lawDiscovery}.ts`, `src/lib/floating/laws/*.ts`, `src/pages/floating/{ReasoningPage,VerificationPage}.tsx`, components for chip diff + coverage bar + law card.
- New: `supabase/functions/notebook-ai/floating-reason/index.ts` (+ mirrored modules).
- New migration: 4 tables above with GRANTs + RLS.
- Edit: `src/pages/FloatingNumbersPage.tsx` — wire Generate → Reasoning, add status badges, gate downstream on `verified`.
- Edit: `src/lib/smartboard/floatingPlan.ts` consumer path to only ingest verified chip sets.
- Tests as listed above.
