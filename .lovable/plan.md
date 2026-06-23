# Self-Training Floating Number AI — Engine Knowledge Pipeline

Make the generation engine document its own reasoning. Every successful Floating Number generation writes an explanation that becomes a visible "Engine Knowledge" document, and the Floating Number AI reads those documents alongside teacher laws.

## 1. Engine Knowledge as a document category

Reuse `floating_knowledge_documents` (already used for teacher docs). Add two new `kind` values used everywhere:

- `engine_principle` — static, hand-seeded primers (sign detection, fraction protection, bracket scanning, container boundary rules). Seeded once via migration so the teacher can immediately open and edit them.
- `engine_generation_log` — auto-written per successful generation, contains the structured self-explanation.

No new table. Filter and label in the UI by `kind`.

## 2. Auto self-explanation on every generation

Hook into the existing floating generation path (`supabase/functions/notebook-ai` `mode: "floating"` + `floating-reason`). After a successful generate-and-verify, the edge function writes one `engine_generation_log` row containing:

```
{
  input_expression,
  generated_structure: { fillers, containers, arrangement },
  applied_laws: [{id, number, name}],
  generation_reasoning: "Scanned left to right. '+' bonded to next term. Three containers created.",
  validation_reasoning: "Coverage 100%, reconstruction exact.",
  confidence_score,
  rejected_alternatives?: [...]
}
```

Stored as `parsed_text` (human-readable rendered version, so the teacher reads it like a doc) + `metadata` (the JSON above). `filename` auto-titled e.g. `Generation Log — 3x²+5x+1 — 2026-06-22`.

Writes are best-effort and non-blocking: a failure never blocks the generation response.

## 3. Seed Engine Principle documents

Migration inserts ~6 starter `engine_principle` docs, one per core engine rule the generator actually uses (sign detection, fraction protection, bracket scanning, container boundary, arrangement ordering, validation contract). Body is plain markdown describing what the engine code does today. Teacher can edit them like any other doc.

## 4. Teacher visibility (AI Settings → Knowledge)

In `src/pages/floating/AiSettingsPage.tsx`, add a "Source" filter / section grouping with three tabs or section headers:

- Teacher Documents (`kind = law_document` and existing teacher kinds)
- Engine Principles (`kind = engine_principle`)
- Generation Logs (`kind = engine_generation_log`, newest first, searchable by input expression)

Each opens in the existing document viewer (the Notion-style viewer added earlier). Generation logs render the structured fields as labeled sections.

## 5. Floating Number AI ingests Engine Knowledge

In `floating-assistant/index.ts` `hydrateKnowledge`, extend the snapshot:

- Existing: Laws + Drafts + teacher documents + example analyses + recent generations.
- Add: latest N `engine_principle` docs (inline, small) and a token-budgeted window of the most relevant `engine_generation_log` rows — relevance = same topic / similar input expression to the current `lessonContext.activeLineText`.
- The existing `lookup_document` tool already handles on-demand retrieval of any doc id, so older logs stay reachable without bloating every prompt.

System prompt update: "Engine Knowledge is the generator explaining itself. Trust it for *how* a structure was produced; trust Laws for *why* a structure is correct."

## 6. Continuous loop, no manual retraining

Because the snapshot is rebuilt per request, every new generation log is immediately part of the AI's context on the very next message. No retraining job, no embeddings step in this pass.

## Technical details

**Files**
- `supabase/functions/notebook-ai/index.ts` (and/or `floating-reason/index.ts`) — after successful floating generation, build self-explanation and insert into `floating_knowledge_documents` with `kind = 'engine_generation_log'`. Wrap in try/catch.
- `supabase/functions/floating-assistant/index.ts` — extend `hydrateKnowledge` to pull `engine_principle` + relevant `engine_generation_log`; update system prompt section.
- `src/pages/floating/AiSettingsPage.tsx` — add filter/section for `engine_principle` and `engine_generation_log`; structured renderer for generation logs.
- Migration — seed initial Engine Principle docs (system-owned rows, or per-user on first visit; simplest: seed per user lazily from a constants file in the edge function on first generation).

**Schema**
- No new tables. Reuse `floating_knowledge_documents`. New `kind` values: `engine_principle`, `engine_generation_log`.
- Optional index: `CREATE INDEX floating_knowledge_documents_owner_kind_idx ON public.floating_knowledge_documents(owner_id, kind, created_at DESC);` for fast filtering.

**Out of scope**
- No embeddings / vector search yet (relevance is by topic + recency).
- No retroactive backfill of past generations.
- No changes to the generator's actual logic — only its self-documentation.
- No new auth, no new buckets.

**Risks**
- Log volume growth → mitigated by listing newest-first with pagination, and AI snapshot using a small relevance window.
- Self-explanation drifting from real engine behavior → keep the explanation generated from the same code path that produced the structure (same function pass), not a separate model call.
