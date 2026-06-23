# Knowledge Base → AI Collaboration Workspace

Transform `AiSettingsPage.tsx` from a 3-column document manager into an AI-first workspace where the Floating Number AI is always the center of the experience.

## New Layout

```text
┌──────────────┬───────────────────────────────────────────┐
│ Sidebar 30%  │  Floating Number AI (70%)                 │
│              │                                           │
│ Search       │  [conversation transcript]                │
│ Official Laws│  [math rendered via renderMathInline]     │
│ Draft Laws   │  [composer: text · voice · file · image]  │
│ Documents    │                                           │
└──────────────┴───────────────────────────────────────────┘

When a law / draft / document is opened:
┌──────────────┬──────────────────────────┬────────────────┐
│ Sidebar 20%  │  Selected item (50%)     │  AI (30%)      │
└──────────────┴──────────────────────────┴────────────────┘
```

- Default: no selection → AI = 70%, Sidebar = 30%, no center panel.
- On selection → item detail mounts in the middle, AI shrinks to ~30% but stays mounted (no remount, no message loss).
- Closing the detail returns to default. AI is never unmounted.

## Sidebar (left)

- One search box filtering across Laws / Drafts / Documents.
- Three collapsible sections: Official Laws, Draft Laws, Documents.
- Clicking a row opens it immediately in the middle panel — no placeholder screen.
- Document upload (PDF / DOCX / TXT / images) stays here.

## Removed

- The "Select a law, draft, or document" placeholder card.
- "Review recent law", "Compare laws", "List approved laws", quick-prompt buttons.
- Any middle-column empty state. The AI fills that space instead.

## Floating Number AI (primary workspace)

Reuses the existing `floating-assistant` edge function with `workspace: "knowledge"` so memory, laws, drafts, and documents are shared with the Generation page (already wired in prior turn).

Composer affordances:
- Text input (multi-line, Enter to send).
- Voice input via existing `useVoiceInput` hook (SpeechRecognition → transcript into composer).
- File upload: PDF, DOCX, TXT (sent as base64 `file` parts to the edge function — already supported).
- Image / screenshot upload: sent as `image_url` parts (base64 data URL).
- Drag-and-drop onto the conversation area routes into the same attachment pipeline.

Conversation surface:
- Scrollable transcript, persistent across navigation within the page.
- Messages render math via the existing `renderMathInline` / `MathTreeRender` pipeline (same engine Lesson Notes uses). A small post-processor runs `toUnicodeMath` + `renderMathInline` on every assistant chunk so fractions, roots, exponents, Σ, ∫, matrices appear properly stacked — never as raw `\frac` or `x^2`.
- Approval cards for AI-proposed law drafts ("I have created Draft Law 19") remain; on approve the draft is inserted into `floating_law_drafts` and the sidebar list updates via the existing realtime sync.

Real-time voice ("Call AI"): out of scope for this change. Add a disabled "Call AI" button with a tooltip "Coming soon" and leave a `// TODO: realtime voice` hook so the architecture is ready, but do not wire OpenAI Realtime here.

## Law authoring via chat

The AI already has `propose_new_law` / draft tools from the previous turn. Surface them inline in the transcript as action cards (Approve / Edit / Reject). Approval writes to `floating_law_drafts` or promotes to `floating_law_library`, and the sidebar updates immediately through the existing Supabase realtime channel.

## Shared brain

No new tables. The Generation page and Knowledge page both call `floating-assistant` and both read the same `floating_law_library`, `floating_law_drafts`, `floating_knowledge_documents`. The `workspace` field only switches transcript scope; knowledge is global.

## Files touched

- `src/pages/floating/AiSettingsPage.tsx` — restructure to the two-mode layout described above; delete the placeholder card and the quick-action buttons.
- `src/components/floating/KnowledgeChat.tsx` (new, extracted from current inline chat) — owns transcript, composer, attachments, math rendering, draft-approval cards. Persists across selection changes so opening a law does not reset the conversation.
- `src/components/floating/KnowledgeSidebar.tsx` (new) — search + the three sections + upload control.
- `src/components/floating/KnowledgeDetail.tsx` (new) — renders a Law / Draft / Document detail when one is selected; close button collapses back to AI-only mode.

No edge-function changes. No migration. No business-logic changes beyond moving UI.

## Out of scope

- Realtime voice conversation (button is placeholder).
- New schema fields.
- Changes to the Generation page.
