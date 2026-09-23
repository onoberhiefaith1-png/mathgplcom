# Two lesson modes + AI Edit as the front door

## What changes for the teacher

**Mode menu goes from three to two**
- **Manual** — you write and edit yourself (unchanged).
- **Co-Pilot** — now also holds every AI Builder tool: the "AI after Introduction / Explanation / Example / Solution / Exercise / Assessment" buttons and the Transform, Generate, Rewrite, Diagram, Maths and Table tools, plus the Co-Pilot panel.
- "AI Builder" disappears from the menu. Anyone who had it selected opens in Co-Pilot.

**AI Edit gets a second way in**
- **A. Highlight, then AI Edit** — exactly as today. Accept replaces the highlighted content in the same place. Nothing about this path changes.
- **B. New "AI Edit" button in the top bar of the lesson note.** It opens the same panel, but empty. You can paste a full lesson from ChatGPT, a paragraph, a question, maths, or just type an instruction ("write two worked examples on simultaneous equations").
  - Click Generate: AI Edit tidies it with the same structuring it already uses (real sessions, question on its own line, one solution step per line, proper fractions, no code syntax).
  - You see the finished preview first. **Cancel** leaves the note untouched; **Accept** inserts it.
  - Where it goes in: at your cursor if you clicked in the note; otherwise at the end of the note. It never overwrites anything.
- AI Edit stays available in both Manual and Co-Pilot modes, as today.

## Flow

```text
Highlight -> AI Edit -> refine -> Accept -> REPLACES the highlight
AI Edit button -> paste/type -> structure -> preview -> Accept -> INSERTS at cursor / end
Co-Pilot generates -> (optional) AI Edit -> Accept -> lesson note
```

## Not touched
Highlight AI Edit behaviour, Smart Table cell AI Edit, Floating Numbers AI Edit, the Co-Pilot generator and its standards, QUESTION_LOCK, Smartboard, saved notes.

## Technical details
- `src/lib/lessonnotes/aiMode.ts`: type becomes `"manual" | "copilot"`; stored `"mathengine"` is read as `"copilot"`. `useSectionAiVisible()` returns true for copilot. Labels/notes updated.
- `NotebookEditorPage.tsx`: drop the AI Builder menu item; add an "AI Edit" toolbar button that calls a new `openBlankAiEdit()` exposed by `DocumentEditor` (via ref/bridge).
- `DocumentEditor.tsx`: add an insert-mode apply path. `openBlankAiEdit` records `insertAt` (current cursor if the editor had focus, else `doc.content.size`), sets `aiEditTarget = { text: "", kind: "lesson_section", mode: "compose" }`. `applyAiEdit` in compose mode runs `aiTextToNodes(proposed)` and `insertContentAt(insertAt, nodes)` — no range check, no replacement. `runAiEdit` allows empty selection in compose mode and sends the pasted text (or instruction alone) with `mode: "edit"` so the existing notebook-ai structuring runs; context is the text around the insertion point.
- `AiEditPanel.tsx`: `AiEditTarget` gets optional `mode: "replace" | "compose"`. In compose mode show a large paste/type box (no "current" preview), header "AI Edit — new content", Accept wording "Insert into note". Replace mode rendering unchanged.
- `supabase/functions/notebook-ai`: when selection is a whole pasted lesson, the edit prompt is told to return full structured lesson sections (headings for sessions) rather than a single fragment. Redeploy.
- Tests: aiMode migration (mathengine -> copilot), compose-mode apply inserts without deleting existing content.
