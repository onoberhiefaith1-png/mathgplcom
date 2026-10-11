# Plan: how far ChatGPT can run the system (via MCP)

## The honest answer first

ChatGPT works through **tools** — it can only do what a tool exists for. Tools can read and write the app's data (lesson notes, classes, assignments, games, Academia). Tools **cannot** drive the live screen: ChatGPT has no eyes and no hands inside the app, so it cannot move things around the Smartboard in real time like a teacher's finger.

So the full list you asked about splits into three groups:

## Group 1 — Fully possible (content + data work)

ChatGPT can do all of these once we expose the tools:

| Teacher job | MCP tool | Notes |
|---|---|---|
| Generate a lesson note | `create_notebook` | ChatGPT writes the content; the app's existing verifiers still check the maths |
| Align / structure the page | `update_notebook` | Headings, sections, ordering — same document format the editor uses |
| Generate Floating Numbers | `generate_floating` | Reuses the existing floating-line generator, including the question-inheritance lock |
| Assign a note to a class | `assign_notebook` | Creates the same assignment record the UI creates |
| Create a game | `create_game` | Builds a Game with questions/levels from existing data |
| Create an assignment | `create_assignment` | Timed, class-scoped, same as the UI |
| Upload to Academia | `academia_publish` | Adds subject/topic/session/activity rows in the teacher's workspace |
| Read the workspace | `workspace_snapshot`, `list_notebooks`, `get_notebook` | Already partly built |

All of these are database writes the app already knows how to do — the tools just call the same code paths with the same permission checks.

## Group 2 — Possible, but prepared-not-live (Smartboard)

ChatGPT **cannot operate the Smartboard live** — it cannot see the board or drag Floating Numbers around while teaching. What it *can* do is **prepare the board**: arrange the note's blocks, set line order, place Floating Numbers on their lines, set up the presentation — so when the teacher opens the Smartboard, everything is already laid out. The live teaching movement stays human (or stays with the app's own Flow/auto-play features).

## Group 3 — Not possible via MCP

- Changing the app's code, design, or publishing — that stays with Lovable.
- Anything requiring ChatGPT to watch the screen or react to students in real time.

## Proposed build order

1. **Phase A (this draft):** read tools (already exist) + `create_notebook`, `update_notebook`, `generate_floating`, `solve_question`, `workspace_snapshot`.
2. **Phase B:** `assign_notebook`, `create_assignment`, `create_game`, `academia_publish`.
3. **Phase C:** Smartboard preparation tool (layout/arrangement of an existing note).

Each phase reuses existing app code and verifiers, keeps OAuth sign-in, and is verified by calling the tools as a test teacher before we say it works.

## Cost picture

When ChatGPT does the work, the thinking is billed to your ChatGPT plan — not Lovable credits. The only Lovable-side cost left is ordinary hosting/database, which is included in your plan.
