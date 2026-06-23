## Floating Number Intelligence Center — unified AI, shared memory, law lifecycle

Transform `src/pages/floating/AiSettingsPage.tsx` from a 3-tab storage page into a full Intelligence Center, and make the AI on this page literally the same assistant as the one on the Floating Number Generation page (same backend function, same hydrated knowledge, same persisted thread).

### 1. One AI, two workspaces (shared memory)

- Reuse the existing `floating-assistant` edge function for BOTH the Generation page and the Settings page. No second function, no second prompt.
- Persist conversations in the existing `floating_assistant_threads` / `floating_assistant_messages` tables, keyed by `(owner_id, subsection_id, workspace)` where `workspace ∈ {"generation","knowledge"}`. Both workspaces read the same laws/drafts/documents, so the "memory" (laws, drafts, docs, corrections, approved chips) is automatically shared via the DB; only the visible chat transcript is workspace-scoped so the two surfaces don't talk over each other.
- Add a small `workspace` field to the request payload so the system prompt can switch focus ("you are in the LAW REVIEW workspace" vs "you are in the GENERATION workspace") while keeping all tools and the same hydrated knowledge base.
- Add a `SYNC AI KNOWLEDGE` button in the Settings header that simply re-fetches laws/drafts/docs and bumps a `lastSyncedAt` timestamp shown in the UI. No new sync table needed — the DB is already the source of truth; the button exists for teacher reassurance and to force a refetch on the Generation page via a lightweight `floating_knowledge_sync` broadcast channel (Supabase realtime).

### 2. New page layout (`AiSettingsPage.tsx` full rewrite)

Two-column ChatGPT-style layout, white bg, black text (same readability rules as the Floating Number AI panel):

- **Left rail (≈360px)**: Intelligence Center navigation
  - Section: **Official Laws (N)** — list, click to open detail
  - Section: **Draft Laws (N)** — list with pending badge
  - Section: **Knowledge Documents (N)** — list with file-type icon
  - Section: **Conversations** — saved chat threads in this workspace
  - Top: `+ New chat`, `Upload document`, `Sync AI Knowledge` buttons
- **Center (flex-1)**: Active detail OR chat
  - When a law/draft/doc is selected → detail card (see §3)
  - Otherwise → full chat transcript (reuses the same `AssistantPanel` chat surface used on the Generation page, in `workspace="knowledge"` mode) with composer supporting text, paperclip (PDF/DOCX/TXT), and mic
- **Right rail (≈300px, collapsible)**: Context panel for whatever is open
  - For a law: usage stats, approval history, related drafts
  - For a draft: source discussion link, proposed wording, Approve / Reject / Edit
  - For a document: extracted candidate laws preview
  - For chat: quick actions (Review law, Compare laws, Summarize doc, Propose law)

### 3. Law / Draft / Document detail cards

- **Official Law card**: name, statement, examples[], date approved, approval history (who/when), usage stats (count of floating-number generations citing this law — derived from existing `floating_generations` via a simple count query; if the column does not exist, fall back to "—" rather than adding new tracking now), "Open in chat" button that seeds the chat with "Review Law X".
- **Draft Law card**: source (chat message id or generation id), why it was created, proposed wording, example, Approve / Reject / Edit-then-approve buttons. Approve moves the row from `floating_law_drafts` to `floating_law_library` (already wired) and broadcasts on the realtime sync channel so the Generation page picks it up instantly.
- **Knowledge Document card**: filename, type, uploaded date, "Scan for laws" button. Scanning calls `floating-assistant` with a system instruction to extract candidate laws/definitions/exceptions/examples from the document text and respond by calling `propose_new_law` for each finding. Each finding is inserted as a row in `floating_law_drafts` with `source = "document:<doc_id>"`. The chat then surfaces a summary: "I found 4 candidate laws in `algebra-rules.pdf`. Promote to drafts?" with bulk approve/reject.

### 4. Document ingestion pipeline

- Frontend keeps the existing upload-to-`floating-knowledge` bucket flow.
- After upload, automatically POST the document bytes (base64) to `floating-assistant` with `{ workspace: "knowledge", intent: "scan_document", documentId }`. The edge function extracts text from PDF/DOCX/TXT (PDF via existing gateway file-block multimodal path; DOCX via a lightweight text extractor in the function; TXT inline), runs the scan, and returns a list of candidate drafts shown inline in the chat for one-click approval.
- Images / screenshots are sent as `image_url` blocks so the AI can read math written on paper or whiteboards.

### 5. Law creation & approval workflow (end-to-end)

- Generation page: when verify returns `NEEDS_NEW_LAW`, the assistant already returns a proposal. We now also write that proposal into `floating_law_drafts` with `source = "generation:<line_id>"` and surface it on the Settings page's Draft Laws section in real time.
- Settings page chat: teacher can say "Create a draft law that …" — the assistant calls `propose_new_law` which inserts a draft row. Teacher reviews in the Draft Laws section and clicks Approve.
- Approval is the only path that moves a draft to `floating_law_library`. The Generation page then automatically uses the new law on the next request because hydration always reads the latest library.

### 6. Law traceability on the Generation page

- The assistant already returns a `law_trace` in tool output. Render it in the AssistantPanel as clickable chips: `Law 1`, `Law 4`, `Custom Law 19`. Clicking a chip opens the Settings page (in a new tab or sheet) scrolled to that law's detail card.

### 7. Law evolution suggestions

- Add a lightweight background job in the Settings page: when the teacher opens the page, fetch the last N approved corrections from `floating_generations` (status = approved with manual edits). Pass them to `floating-assistant` with `intent: "suggest_law_from_corrections"`. The function returns 0–3 candidate drafts shown in a "Suggested by recent corrections" banner above Draft Laws. Teacher can promote any to a real draft.

### 8. Backend changes (`supabase/functions/floating-assistant/index.ts`)

- Accept new optional fields: `workspace`, `intent` (`"chat" | "scan_document" | "suggest_law_from_corrections"`), `documentId`.
- Branch on `intent`:
  - `chat` → existing tool-calling loop (unchanged).
  - `scan_document` → load the document, build a multimodal user message, force the model to emit `propose_new_law` calls; persist drafts directly.
  - `suggest_law_from_corrections` → load recent approved generations, ask the model for pattern-based draft proposals; return without persisting (teacher promotes manually).
- System prompt gains a short `WORKSPACE` line so the model knows whether to focus on generation vs law curation. All tools stay available in both workspaces.

### 9. Schema (single small migration)

- `floating_law_drafts`: add `source text` (e.g. `"generation:<id>" | "document:<id>" | "chat:<thread_id>"`), `approval_history jsonb default '[]'`. GRANTs already exist; just extend.
- `floating_law_library`: add `approval_history jsonb default '[]'`, `usage_count int default 0` (incremented from the generation flow when a law id appears in `law_trace`).
- `floating_assistant_threads`: add `workspace text not null default 'generation'` and a unique index on `(owner_id, subsection_id, workspace)`.
- No new tables.

### 10. Files

- `src/pages/floating/AiSettingsPage.tsx` — full rewrite around the 3-column Intelligence Center layout.
- `src/components/floating/AssistantPanel.tsx` — accept a `workspace` prop and a `lawTrace` renderer with clickable law chips; no behavioural change for the generation workspace.
- `src/components/floating/IntelligenceCenter/` (new) — `LawList.tsx`, `DraftList.tsx`, `DocumentList.tsx`, `LawDetail.tsx`, `DraftDetail.tsx`, `DocumentDetail.tsx`, `SyncButton.tsx`.
- `src/lib/floating/lawSync.ts` (new) — small realtime helper that broadcasts/listens for `floating_knowledge_sync` so the Generation page refetches laws after an approval.
- `supabase/functions/floating-assistant/index.ts` — add `workspace` / `intent` branching, document-scan path, corrections-suggestion path.
- One Supabase migration for the columns listed in §9 (with the required GRANTs preserved).

### Out of scope

- Building a full document-OCR pipeline beyond what the gateway's multimodal file/image blocks already support.
- Per-law fine-tuning or vector embeddings — current hydration (topic-filtered SQL fetch) is enough for now and can be upgraded later if recall becomes a problem.
- Cross-teacher law sharing.
