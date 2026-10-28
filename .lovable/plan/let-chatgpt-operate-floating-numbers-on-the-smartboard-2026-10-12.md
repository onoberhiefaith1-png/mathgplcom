# Let ChatGPT operate Floating Numbers on the Smartboard

## What exists today

- ChatGPT can already **prepare** Floating Numbers: `set_solution_highlights`, `generate_solution_floating_numbers`, `validate_lesson_floating_numbers` (no credits), plus `generate_floating` (uses credits).
- ChatGPT can already **drive the Smartboard** coarsely: `open_screen` and `smartboard_control` (next/previous step) via the `chatgpt_commands` live link (`ChatGptLiveLink`).
- The on-device Tutor can already **operate the chips** — delete, move, merge, keep-together, generate — but only on the Floating Numbers preparation page, through handlers registered on the Tutor action bus (`floating.delete`, `floating.move`, `floating.merge`, `floating.together`, `floating.generate` in `FloatingNumbersPage.tsx`).

## The gap

ChatGPT has no path to those chip actions:
1. The live link only understands three commands (`open`, `smartboard`, `refresh`) — there is no "run a screen action" command.
2. The chip handlers are registered only on the Floating Numbers preparation page, not on the Smartboard presentation, so even the Tutor cannot move chips while presenting.

## Plan

### 1. A general "screen action" live command
- Add a `screen_action` command to `ChatGptLiveLink`: it calls `callTutorAction(name, args)` on the existing Tutor action bus and reports the result.
- Reuse the existing freshness check (stale commands are discarded) and owner-scoped `chatgpt_commands` row per signed-in teacher. No new tables, no auth changes.

### 2. Register chip actions on the Smartboard presentation
- In `PresentationView` (where `TutorGuideHost` is mounted), register the same Floating Numbers operations against the currently presented question's lines, using the pure helpers in `src/lib/assistant/floatingOps.ts` (deleteChip, moveChip, mergeChips, keepTogether) so preparation-page and Smartboard behavior stay identical.
- Actions act on the line the teacher names (or the currently shown line); the board re-renders from the same saved data, so students see the change live.

### 3. One MCP tool for ChatGPT
- New tool `operate_floating_numbers` in `src/lib/mcp/tools/`:
  - Input: `notebookId`, `subsectionId` (the question), `action` (delete | move | merge | keep_together | generate), `line` (1-based), and the action's arguments (chip number(s), from/to, symbols).
  - Validates the notebook belongs to the signed-in teacher and the action/args against a fixed whitelist, then sends the `screen_action` live command.
  - Description tells ChatGPT to confirm with `inspect_board_state` / `get_current_view` before claiming it worked (sent ≠ applied, per the operating guide).
- Add the tool to the guide's step table and bump `GUIDE_VERSION`.

### 4. Tests
- Pure-helper tests already exist for the chip operations; add tests for:
  - the new tool's whitelist validation (unknown action/args rejected),
  - ownership check (other teacher's notebook rejected),
  - the live-command mapping (action name + args → `callTutorAction` call, stale commands dropped).

## Technical notes

- Files touched: `src/components/chatgpt/ChatGptLiveLink.tsx`, `src/lib/chatgpt/liveCommand.ts`, `src/components/smartboard/PresentationView.tsx` (new registered handlers), new `src/lib/mcp/tools/operate-floating-numbers.ts`, `src/lib/mcp/index.ts`, `src/lib/mcp/guide/operatingGuide.ts`, plus tests.
- No database, auth, or RLS changes. No credits used. Plugin stays private; nothing published.

## What ChatGPT still cannot do after this

- Drag chips with pixel precision or touch gestures — operations stay at the "chip 3 to position 1" level, same as the voice Tutor.
- Operate chips while the teacher's MathGPL window is closed (commands expire after one minute).
