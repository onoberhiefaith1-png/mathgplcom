# Plan: ChatGPT runs lesson-note work via MCP (Phase A)

## What gets built
Five new tools on the app's existing MCP server, so ChatGPT (on your ChatGPT plan) can do real content work in your workspace. All tools run as the signed-in teacher with the same permission checks as the app — nothing can touch another teacher's data.

## The tools

1. **workspace_snapshot** (read-only) — lists the teacher's classes and recent notebooks, so ChatGPT knows what exists before acting.
2. **create_notebook** — creates a lesson notebook (title, subject, subtopic, class, teacher) with sections (introduction, explanation, example, exercise, classwork, homework, summary) and content blocks (problem, solution, reasoning, text), in the exact format the editor uses.
3. **update_notebook** — edits a notebook's details and appends new sections/blocks at the end.
4. **solve_question** — saves a step-by-step solution next to an existing question, enforcing the app's solution contract: line 1 must restate the question exactly, one complete micro-step per line, no empty lines, no two equations on one line. Bad solutions are rejected with a clear reason.
5. **generate_floating** — attaches Floating Numbers lines (tap-able token rows) to a question, stored exactly where the Smartboard and Game players read them.

Also: the server is renamed from the old "Golden Hour Academy" placeholder to **MATHGPL**, and the tool manifest is regenerated and verified.

## What ChatGPT writes vs. what the app checks
ChatGPT supplies the teaching content; the app's own validation still gates what gets saved (solution contract, ownership, data shapes). No Lovable AI credits are used — the thinking happens on your ChatGPT plan.

## Not in this phase (can follow)
Assigning to classes, creating games/assignments, Academia publishing, and Smartboard layout preparation (Phase B/C). Smartboard live movement is not possible for any external AI — it has no eyes or hands in the app.

## Verification
- Manifest extraction passes after the changes.
- Each tool is called as a test teacher: snapshot → create → solve → floating → confirm the notebook appears correctly in the app.
- Existing tools (echo, list_notebooks, get_notebook) keep working.

## After building
You republish the app so the new tools are served, then connect ChatGPT (Developer Mode, web only) to the app's MCP address and sign in once.
