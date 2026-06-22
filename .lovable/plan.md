## Floating Number AI Assistant — Conversational Workspace

Transform the Floating Number Generation Page from a button-driven flow (Generate / Reason & Verify / AI Edit / Enter) into a three-panel conversational workspace where a permanent AI Assistant is the primary interface. The teacher talks to the AI; the AI drives the workspace.

### New Page Layout

```text
┌─────────────────────┬─────────────────────────┬──────────────────────────┐
│  LEFT               │  MIDDLE                 │  RIGHT                   │
│  Equation Lines     │  Floating Workspace     │  Floating Number AI      │
│  (highlight source) │  (chips, scaffolds,     │  Assistant (chat)        │
│  - lesson title     │   verification badges)  │  - context strip         │
│  - each line click- │  - per-line status:     │  - message thread        │
│    able to select   │    Pending / Verified ✓ │  - voice + uploads       │
│  - selected line    │    / Failed ✗           │  - "Current selection"   │
│    highlighted      │  - reconstruction diff  │    auto-injected         │
│                     │    inline (no separate  │  - command results       │
│                     │    page)                │    render in middle      │
└─────────────────────┴─────────────────────────┴──────────────────────────┘
```

Removed from the UI: the per-line **Reason & Verify →**, **AI Edit**, and **⏎ Enter** buttons. Reasoning, verification, editing, and law discovery move into the AI thread and into inline middle-panel cards. The `/floating/.../reason` and `/floating/.../verify` routes are retired (existing pages kept as dead code one cycle, then removed).

### Interaction Model

1. Teacher clicks an equation line on the **Left**.
2. The AI panel's context strip updates: `Current selection: 4(a-b)=0` (auto, no copy/paste).
3. Teacher types/speaks a command in the **Right** panel:
   - "Generate floating numbers" → AI calls `floating-reason`, writes chips into the middle panel, posts a reasoning + verification message in chat.
   - "Keep a and b together" → AI re-runs with a constraint, updates chips.
   - "Verify all elements" / "Reconstruct equation" → AI re-runs verifier, posts coverage + diff card.
   - "Apply Law 7" / "Explain this law" → AI references the Law Library.
   - "Undo last change" → reverts to prior chip snapshot.
4. Every AI turn that mutates the workspace produces a **diff card** in chat (before → after chips, applied laws, coverage %, exact-match status) with **Approve / Regenerate / Reject** buttons. Approve commits; coverage must be 100% and reconstruction exact, else Approve is disabled and the AI is told to retry.
5. On Approve, if the change is not explainable by existing laws, the AI proposes a **Draft Law** card inline in the thread → Approve / Edit / Reject (writes to `floating_law_library` or `floating_law_drafts`).

### Knowledge Base & Law Library (Settings tab)

A new **AI Settings & Knowledge Base** screen (route `/lesson-notes/:id/floating/:sub/ai-settings`) with tabs:

- **Official Laws** — approved laws (from `floating_law_library`).
- **Draft Laws** — pending proposals (`floating_law_drafts`), Approve/Edit/Reject.
- **Corrections** — historical teacher corrections (evidence only).
- **Approved / Rejected Examples** — kept per teacher.
- **Knowledge Documents** — uploads (PDF, DOCX, TXT, images, screenshots, voice notes) stored in a new `floating-knowledge` storage bucket, parsed server-side and indexed.
- **Version History** — each law has `version`, `revisions[]`, `exceptions[]`, `superseded_by`.

The AI always retrieves from this knowledge base (per-teacher, scoped by `owner_id = auth.uid()`) before answering. No law becomes active without explicit teacher approval.

### Capabilities the AI Exposes (server-side tools)

Single `floating-assistant` edge function with a tool-calling loop. Tools:

- `generate_chips(selection, constraints?)`
- `verify_chips(selection, chips)`
- `reconstruct(selection, chips)`
- `explain_law(law_id)` / `compare_laws(a,b)` / `list_applicable_laws(selection)`
- `propose_draft_law(before, after, reason)`
- `undo_last_change(line_id)`
- `search_knowledge(query)` — over uploaded docs + law library
- `apply_chips_to_workspace(line_id, chips, scaffolds)` — the only write tool; UI shows diff card requiring Approve

Every `apply_chips_to_workspace` runs `verify_chips` server-side first; if not PASS it returns the failing trace to the AI for retry (max 2), then surfaces FAIL to the teacher rather than silently committing.

### Inputs Supported in the Chat

Text, voice input (Web Speech API → transcript), voice output (TTS via Lovable AI), image/screenshot upload, document upload (PDF/DOCX/TXT via `document--parse_document` server-side), law upload (routed into Draft Laws extraction flow).

### Persistence Changes

New + extended tables (migration, with GRANTs + RLS by `owner_id`):

- `floating_assistant_threads` — one per (notebook, subsection, teacher); stores message log.
- `floating_assistant_messages` — `{thread_id, role, content, tool_calls, tool_results, attachments_json, created_at}`.
- `floating_knowledge_documents` — `{owner_id, kind, filename, storage_path, parsed_text, indexed_at}`.
- `floating_law_library` — add `version`, `revisions jsonb`, `exceptions jsonb`, `superseded_by uuid`.
- `floating_chip_snapshots` — per-line history for Undo.
- Storage bucket `floating-knowledge` (private, RLS by `owner_id`).

Existing `floating_generations`, `floating_law_drafts`, `floating_restructure_events` are reused. `floating_restructure_events` is now written from chat turns rather than the old Restructure panel.

### Files to Create / Change

**Create**
- `src/pages/FloatingNumbersPage.tsx` — rewrite into 3-panel layout (keeps file path; old single-column flow removed).
- `src/components/floating/EquationLinesPanel.tsx` (left).
- `src/components/floating/WorkspaceCanvas.tsx` (middle: chips, inline coverage bar, reconstruction diff, status badges, diff cards).
- `src/components/floating/AssistantPanel.tsx` (right: thread, composer, voice, uploads, context strip).
- `src/components/floating/AssistantMessage.tsx`, `DiffCard.tsx`, `DraftLawCard.tsx`, `CoverageCard.tsx`.
- `src/hooks/useFloatingSelection.ts` — tracks active line + emits to AI context.
- `src/hooks/useFloatingAssistant.ts` — thread state, streaming, tool-result handling.
- `src/pages/floating/AiSettingsPage.tsx` + tab components for Official / Draft / Corrections / Examples / Knowledge / Versions.
- `src/lib/floating/knowledgeIndex.ts` — client wrapper for knowledge search.
- `supabase/functions/floating-assistant/index.ts` — chat + tool-calling loop (Lovable AI Gateway, `google/gemini-3-flash-preview`). Reuses existing `elementDetector.ts`, `laws.ts`, `verifier.ts` mirrors.
- `supabase/functions/floating-knowledge-ingest/index.ts` — parses uploaded docs, stores extracted text + proposed law drafts.
- Migration: new tables, bucket, RLS + GRANTs, extends `floating_law_library`.

**Edit**
- `src/App.tsx` — register `/ai-settings` route, drop `/reason` and `/verify` routes.
- `src/lib/smartboard/floatingPlan.ts` — keep consuming only `verified` chip sets (unchanged contract).
- `src/integrations/supabase/types.ts` — regenerate after migration.

**Remove (after one cycle)**
- `src/pages/floating/ReasoningPage.tsx`, `VerificationPage.tsx` — functionality fully absorbed into the chat + middle panel.
- Old `Reason & Verify` / `AI Edit` / `Enter` buttons in the current `FloatingNumbersPage`.

### Out of Scope (this plan)

- Highlighting Page, Lesson Notes flow, Smartboard rendering, Floating Workspace consumer — unchanged.
- Auto-approving laws or auto-committing AI chip changes — every mutation requires explicit teacher Approve.
- Cross-teacher law sharing — each teacher's library stays scoped to `owner_id`.

### Verification Guarantees (carried over, non-negotiable)

No chip set is committed unless:
1. Coverage = 100% over the original element fingerprint.
2. Reconstruction is exact (canonical equality).
3. Teacher clicks Approve on the diff card.

Failure modes surface in the chat with explicit missing elements; the AI retries up to 2× server-side, then reports FAIL rather than dropping elements.
