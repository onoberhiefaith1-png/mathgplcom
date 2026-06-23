# Floating Number AI — Unified Modes + Storage Outputs

## Goal

Keep the existing single chat interface and right-hand sidebar (Official Laws, Draft Laws, Documents). Add a **Mode Selector** next to the Upload Image / Upload File / Voice buttons, and treat Draft/Official Laws + Documents purely as **storage outputs** that the AI proposes at the end of a session. The AI stays a full general-purpose assistant with Floating Number specialization.

No new pages. No tab refactor. Existing sidebar, approval cards, voice input, and attachments stay.

## 1. Mode Selector (frontend)

In `src/pages/floating/AiSettingsPage.tsx` composer row (next to Upload Image / Upload File / Mic):

- Add a compact dropdown / segmented control: **Conversation**, **Training**, **Knowledge Extraction**.
- State: `const [mode, setMode] = useState<"conversation"|"training"|"extraction">("conversation")`.
- Persist mode in `localStorage` per subsection so it survives reload.
- Show a small badge above the input ("Training mode — I will learn from what you share") so the user knows which mode is active.
- Mode is sent with every `send()` call as `mode` in the request body to the edge function.

No changes to the sidebar layout, collapse behavior, or AI/detail/sidebar widths.

## 2. Mode behavior (backend prompt)

In `supabase/functions/floating-assistant/index.ts`, extend the request schema with `mode` and inject a **mode-specific addendum** into the existing dual-mode system prompt. The general-purpose + Floating-Number identity from the last change stays intact.

- **Conversation** (default): current behavior. Free general-purpose chat, optional tool use, no nudges to save anything unless the user asks.
- **Training**: AI acknowledges teacher input ("I understand.", "I have learned this principle.", "This may be useful for future floating number generation."), summarizes what it learned, and at the end offers: *Create Draft Law*, *Create Document*, *Save as Knowledge*. Never auto-promotes anything.
- **Knowledge Extraction**: AI focuses on discovery — detect concepts, patterns, principles; extract examples; propose laws; generate documentation. Output is structured (sections: Concepts / Patterns / Proposed Laws / Suggested Examples / Suggested Document Outline).

All three modes keep tool access (`analyze_example`, `generate_chips`, `verify_chips`, `lookup_law`, `propose_new_law`, `apply_chips`, `undo_last_change`) — tools remain optional and the model decides when to call them.

## 3. End-of-session storage prompt

On the **last assistant turn of a Training or Extraction session** (heuristic: when the AI signals "done" or after N turns of teacher input without follow-up), the AI appends a structured action block the frontend renders as buttons:

```
ACTIONS:
- save_knowledge: "<title>"
- create_draft_law: "<proposed name>"
- generate_document: "<draft id or proposed title>"
- discard
```

`AssistantPanel.tsx` parses this block and renders the four buttons. Clicking:

- **Save as Knowledge** → inserts a row in `floating_knowledge_docs` (existing `docs` table) with `kind = 'note'`.
- **Create Draft Law** → calls existing `propose_new_law` flow (writes into `floating_law_drafts`).
- **Generate Document** → calls a new lightweight server route `generate-law-document` that produces a Markdown doc using the law's name/statement/examples and stores it in `floating_knowledge_docs` with `kind = 'law_document'` and `linked_law_id`.
- **Discard** → no-op + toast.

## 4. Law-document generation

When a Draft Law is approved (existing `approveDraft` in `AiSettingsPage.tsx`) or a teacher clicks **Generate Law Document**, call the new edge function (or reuse `floating-assistant` with `mode = "document"`) that produces:

```
Title
Law Statement
Explanation
Examples (1..N)
Floating Number Applications (1..N)
Common Mistakes
Related Laws
```

Stored in `floating_knowledge_docs`. Documents appear in the existing Documents section of the sidebar — no UI change there.

## 5. Official Law display

Official Laws stay short. Approval flow already moves a Draft into `floating_law_library` with `law_number`, `name`, `statement`. The detail view in `AiSettingsPage.tsx` (the middle column when a law is selected) keeps the same fields. The auto-generated long document lives separately under Documents and is linked from the law via `linked_law_id`.

## 6. Files touched

- `src/pages/floating/AiSettingsPage.tsx` — Mode Selector UI, `mode` state, pass `mode` to chat, "Generate Law Document" button on approved laws and draft cards.
- `src/components/floating/AssistantPanel.tsx` — render ACTIONS block as buttons (Save as Knowledge / Create Draft Law / Generate Document / Discard); send `mode` in request body.
- `supabase/functions/floating-assistant/index.ts` — accept `mode`, inject mode-specific prompt addendum, emit ACTIONS block at end of Training/Extraction turns.
- `supabase/functions/generate-law-document/index.ts` — new edge function that produces the full Markdown law document and inserts into `floating_knowledge_docs`.
- (Optional schema) add `linked_law_id` and `kind` columns to `floating_knowledge_docs` if they don't exist; migration only if needed.

## 7. Out of scope

- No new pages or routes.
- No changes to the right-sidebar layout, collapse behavior, voice input, or attachment pipeline.
- No changes to existing tool definitions or approval cards.
- General-purpose identity from the previous change is preserved.

## Verification

- Switch to Training, paste a rule → AI replies with "I understand…" + ACTIONS block; clicking *Create Draft Law* creates a draft visible in the sidebar.
- Switch to Knowledge Extraction, upload a PDF → AI returns structured Concepts/Patterns/Proposed Laws + ACTIONS block.
- Approve a draft → law appears in Official Laws (short form) AND a "Generate Law Document" button is offered; clicking it creates a full Markdown doc in Documents.
- Conversation mode answers "Tell me a story" / "Explain photosynthesis" with no storage prompts.
