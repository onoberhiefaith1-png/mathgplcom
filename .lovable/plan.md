# Presentation AI — Autoplay + Diagnosis Master

Build a dedicated "Presentation AI" that owns Smartboard playback and continuously verifies it against the Presenter Preview (the source of truth). Not a lesson generator — a presenter, inspector, diagnostician, and self-repair engine.

## Scope

- Autoplay engine driving the same beat/line cursor a teacher advances manually.
- Speed presets (Fast 10s / Standard 30s / Slow 60s / Detailed 120s per line).
- Continuous verification: after every step, compare Smartboard state to Preview state.
- Diagnosis Panel overlay (30% right, does not resize the Smartboard).
- Self-repair for a bounded set of sync/render issues; escalation via generated Lovable prompt for anything requiring code changes.
- End-of-lesson PASS/FAIL report.

## User flow

1. Teacher opens a lesson on the Smartboard.
2. Clicks new **Autoplay** control (in the existing top-right cluster near Preview toggle).
3. Speed popover appears → pick preset → playback starts.
4. Smartboard advances beat-by-beat, line-by-line, revealing floating numbers and teacher notes exactly as the Preview shows them.
5. A small **AI Diagnosis** icon appears top-right during Autoplay. Green dot = healthy, red dot = error detected.
6. On error: playback pauses at the exact position, icon turns red, panel auto-opens with error card + three actions: **Rectify**, **Proceed**, **Generate Lovable Prompt**.
7. At end of lesson: report card summarizing checks, repairs, and PASS/FAIL.

## Architecture

```text
                 ┌──────────────────────────┐
                 │   PresentationAI (hook)  │
                 │  - autoplayLoop()        │
                 │  - inspect()             │
                 │  - diagnose()            │
                 │  - repair()              │
                 └────────────┬─────────────┘
                              │ reads
     ┌────────────────────────┼────────────────────────┐
     │                        │                        │
 Preview model           Smartboard state        Repair actions
 (buildBeats +           (beatCursor,            (setBeatCursor,
  buildReservoirs)        activeLineIdx,          writeProseLineOnBoard,
                          shownNotebookIdx,       setNotebookAttentionIdx,
                          rendered DOM refs)      scrollIntoView, …)
```

Single source of truth: the `items`/`beats`/`reservoirs` already computed for PresenterPreviewPanel. The AI reads that model and compares against the live Smartboard state exposed by `PresentationView`.

## Files

New:
- `src/lib/smartboard/presentationAI/model.ts` — expected-state snapshot per beat/line (section, line idx, expected floating chips, expected note text, expected highlight target).
- `src/lib/smartboard/presentationAI/inspector.ts` — pure functions: `diffBeat(expected, actual) → Issue[]`, categorized by section/highlight/scroll/floating/note/rendering/sync.
- `src/lib/smartboard/presentationAI/repairs.ts` — repair recipes keyed by issue type; each returns `{ apply(), verify(), label }`.
- `src/lib/smartboard/presentationAI/lovablePrompt.ts` — builds a copy-pasteable Lovable prompt from an unresolved `Issue` (problem, component, expected, actual, probable cause, suggested implementation).
- `src/hooks/usePresentationAI.ts` — state machine: `idle | presenting | paused | repairing | reporting`; owns speed, cursor advancement, inspection cadence, issue log, and report.
- `src/components/smartboard/AutoplayControl.tsx` — top-right button + speed popover (presets + custom slider).
- `src/components/smartboard/DiagnosisPanel.tsx` — right-side overlay (portaled into SmartboardRoot). Header status dot, current-step readout, issue card with Rectify/Proceed/Generate Prompt, scrollable issue log, end-of-lesson report view.
- `src/components/smartboard/DiagnosisPromptModal.tsx` — shows generated Lovable prompt + Copy button.

Edited:
- `src/components/smartboard/PresentationView.tsx` — mount `usePresentationAI`, expose a small imperative surface (cursor setters, note/floating triggers, ref map for cards) via a context so the hook can drive playback and inspection without prop drilling. Render `AutoplayControl` + `DiagnosisPanel`.
- `src/components/smartboard/PresenterPreviewPanel.tsx` — no behavioral change; expose ref map through context so inspector can read DOM state.
- `.lovable/plan.md` — append feature entry.

No changes to buildBeats/buildReservoirs, note-purity, student view, or sync protocol.

## State machine (hook)

```text
idle ──Autoplay→ presenting ──tick→ inspect()
   ↑                │                │
   │                │           issues? ── no → advance()
   │                │                │
   │                ↓           yes ↓
   │           reporting ← end     paused
   │                                │
   │                     ┌──────────┼──────────────┐
   │                     ↓          ↓              ↓
   │                Rectify → repairing     Proceed → advance()
   │                     │                          
   │                     ↓                          
   │              verify ok? ── yes → presenting   
   │                     │                          
   │                     ↓ no                       
   │              stay paused + offer Generate Prompt
   └── Stop from any state
```

## Verification checks per step

Expected vs actual, using data already available:
- Active beat id matches `beatCursor`.
- Active line index matches `activeLineIdx` (clamped).
- For each `guidedLines[i]` up to `activeLineIdx`:
  - if `line.fillers.length > 0` → floating chips rendered on board (data present in shown state).
  - if `line.notebook` non-empty and passes note-purity → note appears in `shownNotebookIdx` OR `notebookAttentionIdx === i`.
- Highlighted card: DOM element for `activeBeatId` has the highlight class; no other card does.
- Scroll: highlighted card in preview is within its scroll container's viewport.

Each failing check → typed `Issue` with `{ kind, section, lineIdx, expected, actual, repairable: boolean }`.

## Self-repair recipes (bounded, safe)

- `note-missing` → call `writeProseLineOnBoard(rawNote)` + update `shownNotebookIdx`.
- `floating-missing` → re-trigger the reveal path for that line (same call the Next button uses).
- `highlight-wrong` → force `setBeatCursor(expected)` / `setActiveLineIdx(expected)`.
- `scroll-out-of-view` → `scrollIntoView({ block: "center" })` on the preview card via ref map.
- `beat-cursor-drift` → resync from expected model.

Anything outside this whitelist (missing sections, broken math rendering, structural mismatches, missing DOM refs, animation deadlocks) is marked `repairable: false` and routed to the Lovable-prompt generator.

## Generated Lovable prompt template

```
Presentation AI detected an unresolvable issue.

Component: <file:line-hint>
Section: <caption>
Line: <n>
Problem: <human summary>
Expected (from Presenter Preview): <expected>
Actual (from Smartboard): <actual>
Probable cause: <heuristic>
Suggested implementation: <recipe if any>
Repro: Autoplay at <speed> preset on notebook <id>.
```

Copy button writes to clipboard; modal stays open until dismissed.

## End-of-lesson report

Rendered inside DiagnosisPanel when state is `reporting`:
- Sections tested, lines tested, floating numbers verified, teacher notes verified.
- Highlight events, scroll events, sync checks, repairs performed.
- Unresolved issues list (each with "Generate Prompt").
- Big PASS or FAIL banner.

## Explicit non-goals

- No AI-generated math or content; no calls to the notebook-ai / floating-* edge functions.
- No changes to the student-facing board or realtime broadcast protocol.
- No modification of note-purity or floating extraction logic.
- No auto-repair for code-level bugs — those always go to prompt generation.

## Verification before finishing

- Manual autoplay of a lesson at Fast preset completes with 0 issues on a known-good notebook.
- Injecting a synthetic missing-note (temporarily comment out the note auto-reveal effect) causes: pause, red dot, issue card, Rectify succeeds, playback resumes.
- Injecting a structural issue (e.g., missing beat) causes: pause, red dot, `repairable: false`, Generate Prompt produces a well-formed prompt.
- End report renders and reflects the injected+repaired issue counts correctly.
