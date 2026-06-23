# Floating Number AI — Knowledge Integration & Workspace Control

Turn the existing Floating Number AI from a side panel chatbot into the platform's intelligence layer: it ingests all Floating Number knowledge live, can analyse highlighted equations, and can directly operate the workspace through approval-gated proposals.

## 1. Knowledge synchronization (server)

Extend `supabase/functions/floating-assistant/index.ts` so every request hydrates a fresh `FloatingKnowledgeSnapshot` for the calling user, built from:

- `floating_law_library` (Official Laws — number, name, statement, examples)
- `floating_law_drafts` (Draft Laws)
- `floating_knowledge_documents` (parsed_text + `law_document` type)
- `floating_example_analyses` + `floating_chip_snapshots` (teacher corrections / approved structures)
- `floating_generations` (recent AI generations)
- Current lesson notebook (already via `lessonContext`)

Snapshot is assembled per request — no manual retraining, always current. Large bodies are token-budgeted: laws and short docs go inline; longer documents are summarized with title + first N chars and become retrievable on demand via a `lookup_document` tool. Snapshot is injected into the system prompt under a `## FLOATING_KNOWLEDGE` section with stable IDs (`LAW#5`, `DOC#abc123`) so the AI can cite them ("According to Law 5 and Law 5 Document…").

## 2. Document auto-ingestion

When a document is uploaded or generated (existing `floating_knowledge_documents` insert path in `AiSettingsPage.tsx`), no extra step is required — because the snapshot is rebuilt on every AI request, new docs are immediately visible. Add:

- A lightweight `indexed_at` + `summary` column on `floating_knowledge_documents` (migration) populated by a one-shot summarisation call on insert, used to keep the snapshot compact.
- Storage-fallback parsing already exists; reuse it server-side when `parsed_text` is null.

## 3. Analysis mode

Add a new assistant action `analyse_structure` triggered when the user highlights a line (existing highlight pipeline in `FloatingWorkspace.tsx` + `AssistantPanel.tsx` already forwards `activeHighlight`).

Server returns a structured `analysis` payload:

```
{
  detected_terms: ["5x", "-4y", "+2y"],
  applicable_laws: [{id, number, name, why}],
  recommended_structure: { fillers, containers, arrangement },
  reasoning: "According to Law 2…"
}
```

The panel renders this as an Analysis card with **Accept / Modify / Reject** buttons. Accept routes through the existing `apply_chips` approval flow.

## 4. Full workspace control (new tools)

Extend the assistant's tool/action set beyond today's `apply_chips`, `undo_last_change`, `approve_draft_law`, `reject_draft_law` with workspace operators:

| Tool | Effect on `FloatingLine` |
|---|---|
| `move_filler` | Reorder `arrangement` (e.g. "Move 5x to container 2") |
| `add_filler` | Append a filler chip with optional container tag |
| `remove_filler` | Delete a filler by value or index |
| `add_container` / `remove_container` | Edit `containers[]` |
| `set_arrangement` | Bulk reorder |
| `generate_line` | Produce a complete proposed `FloatingLine` for a given equation/line id |
| `apply_chips` | (existing) bulk apply |
| `undo_last_change` | (existing) |

Each tool resolves to a typed `ProposedAction` the panel renders as a diff card.

## 5. Approval workflow

All workspace-mutating tools return `needsApproval: true` proposals. The panel shows:

1. Human-readable description ("Move 5x → container 2 on line 3")
2. Before/after preview (reuse mini `FloatingWorkspace` render)
3. **Accept & Apply** / **Reject** buttons
4. Verification badge (blocks Accept when `verification_pass !== true`, same pattern as today)

No tool writes to the page without an explicit Accept click.

## 6. Two-way synchronization

- **Page → AI:** `lessonContext` already includes `activeLineId` / `activeLineText`. Extend it with the active line's current `fillers`, `containers`, `arrangement` so the AI always sees the latest manual edits.
- **AI → Page:** Proposals carry a `targetLineId`. On Accept, the panel calls a single `applyProposal(action)` handler on the parent (`FloatingNumbersPage` / lesson note page) that mutates the line through the existing `onChange(line)` path used by `FloatingWorkspace`. This guarantees both manual chips and AI chips flow through the same reducer.

## 7. AI role / system prompt

Rewrite the system prompt so the AI identifies as: *Teacher Assistant · Floating Number Expert · Knowledge Manager · Law Interpreter · Structure Analyzer · Workspace Operator.* Prompt instructs it to:

- Always cite laws/documents by their snapshot ID when reasoning.
- Prefer tool calls over prose when the user requests a workspace change.
- Never claim "Done" without emitting an approval-gated proposal first.

## Technical Details

**Files**
- `supabase/functions/floating-assistant/index.ts` — snapshot builder, new tools, structured `analysis` response, updated system prompt.
- `supabase/functions/floating-assistant/knowledgeSnapshot.ts` *(new)* — pure builder querying the tables above with a token budget.
- `src/lib/floating/lessonContext.ts` — add `activeLineState` (fillers/containers/arrangement).
- `src/components/floating/AssistantPanel.tsx` — new `ProposedAction` kinds, Analysis card, per-tool approval cards, `applyProposal` callback prop.
- `src/components/lessonnotes/FloatingWorkspace.tsx` — surface active line state up + accept proposals down (small prop additions; no refactor of chip UI).
- `src/pages/FloatingNumbersPage.tsx` / parent — wire `applyProposal` to existing `onChange`.

**Migration**
- `floating_knowledge_documents` add `summary text`, `indexed_at timestamptz`.

**Out of scope**
- No new tables for knowledge; reuse the eight existing ones.
- No streaming refactor; keep current request/response shape.
- No change to chip rendering, KaTeX, or the lesson note generator.

**Risks**
- Token budget on snapshot — mitigate with summaries + on-demand `lookup_document` tool.
- Concurrent manual + AI edits — `targetLineId` + line version check before applying a proposal; stale proposals show "Line changed — re-analyse".
