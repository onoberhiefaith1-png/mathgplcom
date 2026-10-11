# MathGPL inside ChatGPT — live split-screen control

## The answer: yes, mostly
MathGPL already has a ChatGPT connection point with 8 tools (notebooks, solve, Floating Numbers). Any MathGPL user can add it in ChatGPT, sign in with their own MathGPL details, and ChatGPT acts as **that** account — not a developer account. ChatGPT does the thinking with the user's own ChatGPT plan, so it does not spend your Lovable/MathGPL AI credits. The MathGPL tools themselves are normal app actions and cost nothing.

What is missing today: MathGPL on the other half of the screen does not react live, and ChatGPT can only touch lesson notes.

## What we will build

### 1. Live "remote control" link
- In MathGPL, a small **"ChatGPT Live"** badge shows when ChatGPT is connected to your account.
- When ChatGPT does something, the open MathGPL window reacts instantly: opens the note, scrolls to the section, highlights the new solution, opens the Smartboard, moves to the next slide.
- Only your own open MathGPL windows receive these commands.

### 2. More things ChatGPT can do
- Lesson notes: create, open, edit a section, add/fix a question, add solution, copy a note.
- Smartboard: open a note on the Smartboard, next/previous slide, go to a question, show/hide solution, start Floating Numbers.
- Explain: "explain this concept" reads the section currently open in MathGPL so ChatGPT explains exactly what is on screen.
- Classes/assignments: list classes, assign a note or Game to a class (asks you to confirm first).
- Games/Academia: list and open (no editing of Game design in this phase).
- Every change that saves or assigns something asks ChatGPT to confirm with you first.

### 3. Voice
- ChatGPT's own voice mode does the talking. You speak to ChatGPT, it uses MathGPL tools, MathGPL updates live on the other screen.
- Limitation: ChatGPT decides whether tools are available in its voice mode; on some ChatGPT versions voice can only chat, not use connected apps. If so, typing still works fully. MathGPL's own voice (the archived Aura) stays off, as agreed.

### 4. Make it available to everyone
- Fix the remaining sign-in check issue seen after publishing, then confirm ChatGPT can sign in on mathgpl.com.
- Short "Use MathGPL in ChatGPT" help page with the steps.
- Later, optional: submit MathGPL to the ChatGPT app directory so people can find it by name (OpenAI reviews this; timing is theirs).

## Order of work
1. Make sign-in from ChatGPT work on the published site.
2. Live remote-control link + "ChatGPT Live" badge.
3. Smartboard and navigation tools.
4. "Explain what's on screen" tool, class/assignment tools.
5. Help page; test a full split-screen session.

## Technical details
- Remote control: per-user private realtime channel (`chatgpt:<userId>`); MCP tools broadcast typed commands (`open_note`, `goto_section`, `smartboard_slide`, ...); a client listener mounted in the root layout performs navigation via TanStack router. Commands are validated and ignored if they target data the user does not own.
- "Current screen" context: the client publishes the active route/note/section into a small `chatgpt_presence` row (RLS: owner only) that the `get_current_view` tool reads.
- New tools in `src/lib/mcp/tools/*`, all using `requireUser` (RLS as the caller); write tools carry confirmation-friendly descriptions and non-read-only annotations.
- No changes to Game Pro, Floating Numbers logic, assignment controls, or Aura.
