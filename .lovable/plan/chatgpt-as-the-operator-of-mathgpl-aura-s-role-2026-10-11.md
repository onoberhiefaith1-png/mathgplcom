# ChatGPT as the operator of MathGPL (Aura's role)

## Goal

A teacher talks to ChatGPT (typed or spoken), and ChatGPT operates their MathGPL
account the way Aura did: build lesson notes, create classes and games, solve
questions, attach Floating Numbers, and drive the open MathGPL window live on the
other half of a split screen.

## What already exists

- The MathGPT connector inside ChatGPT signs in as the teacher's own account (OAuth) — not a developer account.
- 11 tools already work: workspace snapshot, list/get/create/update notebooks, solve question, generate Floating Numbers, open screen, Smartboard next/previous, read current view.
- The live link (`ChatGptLiveLink`) already lets ChatGPT switch screens and move the Smartboard in the teacher's open window in real time.
- Aura's full action engine (`executeAgentTool`, ~60 actions) already exists server-side and runs as the signed-in teacher with normal permissions.

## What to build

### 1. Expose Aura's action set to ChatGPT
- Add MCP tools that wrap the existing `executeAgentTool` engine, so ChatGPT gains the same capabilities Aura had, in groups:
  - **Classes:** create class, list students, join code, remove student, link notes/games to a class.
  - **Lesson notes (full authoring):** create, plan, generate content, review section, append/insert/edit/move/remove lines, inspect/repair structure, add session, promote to session, reorder, archive.
  - **Games (Slate):** list rooms/rewards, read/create/update game, configure and place rewards, attach/reorder/remove questions, test, publish.
  - **Teaching:** teach lesson, highlight solution, assign question, read/generate Floating Numbers.
- Reuse the existing executors — no duplicated logic, same permission rules (each teacher only ever touches their own data).

### 2. Strengthen the live split-screen link
- Extend the live command set beyond open/smartboard: refresh after every change (already done), plus "explain what's on screen" using the existing presence/screen-text feed.
- Keep the 60-second command expiry and owner-only scoping as they are.

### 3. Update the connector instructions
- Rewrite the MCP server instructions so ChatGPT understands it is the operator of MathGPL: start with a workspace snapshot, confirm before saving, and use live-control tools when the teacher has MathGPL open beside ChatGPT.

## Honest limits (will state these to the user)

- **Voice:** ChatGPT uses its own voice (ChatGPT's spoken mode). Aura's in-app voice stays with Aura; ChatGPT cannot speak through the MathGPL window.
- **ChatGPT acts when asked** — it cannot proactively watch the screen; the teacher speaks first, ChatGPT does it.
- **Maths quality:** the same verified solution contract (question restated, one micro-step per line) applies to ChatGPT exactly as it does in the app.

## Verification

- Extract the MCP manifest and confirm the new tools appear.
- Sign in via the connector and run a real end-to-end check: snapshot → create a small note → open it on screen → Smartboard next.
- Republish so the hosted connector serves the new tool set.

## Technical notes

- New tool files under `src/lib/mcp/tools/`, registered in `src/lib/mcp/index.ts`; each handler calls `executeAgentTool` with the caller's authenticated client (RLS applies).
- No changes to Aura itself, the Smartboard, Games, or Academia.
