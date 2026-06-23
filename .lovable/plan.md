# Knowledge Base AI — Layout + Voice Fixes

Three targeted changes to `src/pages/floating/AiSettingsPage.tsx` and `src/hooks/useVoiceInput.ts`. No backend, no schema, no edge-function changes.

## 1. Move Laws / Drafts / Documents into the left sidebar

```text
┌────────────────────────┬────────────────────────────────┐
│ LEFT SIDEBAR (30%)     │  AI CONVERSATION (70%)         │
│  🔎 Search             │                                │
│  ▾ Official Laws       │  [transcript + composer]       │
│  ▾ Draft Laws          │                                │
│  ▾ Documents (+upload) │                                │
└────────────────────────┴────────────────────────────────┘

When a law / draft / document is opened:
┌──────────┬───────────────────────────┬──────────────────┐
│ Sidebar  │  Law / Doc viewer (70%)   │  AI chat (30%)   │
│ (auto-   │  (takes the chat's space, │  stays mounted,  │
│ narrows) │   never the sidebar's)    │  never unmounts  │
└──────────┴───────────────────────────┴──────────────────┘
```

- Sidebar holds one search box + three collapsible sections (Official Laws, Draft Laws, Documents) + the document upload control. This replaces the current tabbed left rail.
- When nothing is selected: sidebar 30% / AI 70%.
- When a law/draft/document is opened: detail panel takes ~70% of the remaining width and AI shrinks to ~30%. The sidebar stays at its compact width; the detail panel eats into the AI column, not into the sidebar. AI is never hidden.
- AI chat component stays mounted across selection changes so messages, attachments and voice state persist.
- Close button on the detail panel returns to the default 30/70 layout.

## 2. Voice input fixes (`useVoiceInput.ts`)

Current bugs come from two things in the hook:
- `r.continuous = false` → recognition ends on the first pause, so resuming starts a new session that often re-emits the last final phrase (duplicate) and the interim-only callback path (`interim || p`) overwrites the committed text (overwrite-on-resume).
- Interim results are written into the same state slot as the committed transcript, so a fresh interim string can replace already-committed text.

Fix:
- Switch to `r.continuous = true; r.interimResults = true`.
- Track a `committedRef` (string) inside the hook — the stable, already-finalized transcript for the current dictation session, seeded from the composer's value when `start()` is called.
- On each `onresult`:
  - Append only newly-final segments (using `resultIndex`) to `committedRef`, guarding against repeats by remembering the last appended final string.
  - Compute display = `committedRef + " " + interim` and push that via `onTranscript` as an absolute string. Interim text never erases committed text.
- Continuous dictation: do not auto-stop on short pauses. On `onend` while the user has not pressed stop, auto-restart recognition (silent gap is normal); only stop when the user clicks the mic again or on a hard error. Add a safety idle timeout (~8s of no new results) before truly finalizing, so the session feels continuous but does not run forever.
- On `stop()`: flush interim into committed, fully stop recognition, clear the auto-restart flag.

Result:
- One spoken sentence → one transcription (no duplication).
- Pause → continue appends to existing text instead of overwriting it.
- Short pauses keep the session alive.

No call-site changes needed — the hook's public surface (`{ listening, start, stop }` + the `onTranscript` updater contract) stays the same, so the Knowledge Base composer and any other consumers keep working.

## 3. AI-first guarantees

- The AI chat column is rendered once at the top level of the page and is never conditionally unmounted.
- The detail panel mounts/unmounts inside the right side of the layout; opening or closing it only resizes the AI column, never removes it.
- Removed: the "Select a law, draft, or document" placeholder and any empty middle column — when nothing is selected, the AI simply fills 70%.

## Files touched

- `src/pages/floating/AiSettingsPage.tsx` — restructure layout per section 1; move tabs/lists/upload into the left sidebar; make the detail panel share width with the AI column only.
- `src/hooks/useVoiceInput.ts` — continuous mode + committed/interim split + auto-restart on `onend` per section 2.

## Out of scope

- Edge function, DB schema, realtime channels.
- Generation page.
- Realtime voice ("Call AI") — stays a placeholder.
