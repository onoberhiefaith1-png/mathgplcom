# Plan: ChatGPT takes over lesson-note work via MCP

## Goal
Let ChatGPT (through the app's existing MCP server) create, edit and solve lesson-note content, so that work is paid by the user's ChatGPT plan instead of Lovable/AI credits. App code changes remain a Lovable job — MCP cannot replace that.

## What exists today
- MCP server at `/mcp` with OAuth sign-in (already live): tools `echo`, `list_notebooks`, `get_notebook`.
- Verified content pipelines already in the app (Co-Pilot generators, Math Engine solver, SmartTable/Subcell repair).

## Step 1 — New MCP tools (content work)
- `create_notebook` — create a lesson note (title, subject, content) in the signed-in teacher's workspace.
- `update_notebook` — replace/append sections of an existing note.
- `solve_question` — run the existing verified solver for a question and save the solution (same contract as Co-Pilot: line 1 restates the question, one micro-step per line).
- `repair_table` — run the existing deterministic SmartTable/Subcell repair on a note's table.
- `get_workspace_snapshot` — read-only: classes, notebooks, so ChatGPT knows what exists before acting.

All tools reuse the app's existing generators/verifiers — ChatGPT supplies the instruction, the app's code still verifies the math. Nothing is written without passing the same checks Co-Pilot passes.

## Step 2 — Safety
- OAuth stays on: only the signed-in owner can call tools.
- Write tools confirm the target notebook by id; no bulk deletes.
- Regenerate the MCP manifest after changes and verify it extracts cleanly.

## Step 3 — Connection guide
Short in-chat guide: ChatGPT → Developer Mode → add MCP URL → sign in once → example prompts ("create a lesson note on quadratic equations for Year 10").

## Honest limits
- ChatGPT via MCP can do content work, not app code changes or publishing — those stay with Lovable.
- Usage draws on the user's ChatGPT plan limits; complex jobs may be slower.

## Verification
- Manifest extraction passes.
- Call each new tool with a test account: create a note, solve a question, repair a table; confirm results appear in the app.
