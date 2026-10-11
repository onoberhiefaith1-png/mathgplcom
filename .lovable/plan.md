# Connect MathGPL to ChatGPT (for signed-in teachers)

## Goal
Teachers open ChatGPT, connect MathGPL once with their normal MathGPL sign-in, and can then ask ChatGPT to read their workspace, build lesson notes, solve questions and generate Floating Numbers — using the MathGPL tools that already exist in the app.

## What already exists
- A MathGPL tool server with 8 tools (workspace snapshot, list/get/create/update lesson notes, solve question, generate floating, echo), each acting only on the signed-in teacher's own data.
- A sign-in approval screen (`/.lovable/oauth/consent`) so teachers approve ChatGPT's access.

## What is missing / wrong
1. The connection plugin in `vite.config.ts` uses the wrong variant (`stacks/supabase/vite`); this project is TanStack Start and must use `@lovable.dev/mcp-js/stacks/tanstack/vite`.
2. The generated connection routes (`src/routes/mcp.ts` and the OAuth metadata route) do not exist yet — they are generated once the correct plugin runs.
3. The sign-in authorization server has not been activated on the backend.
4. The app has not been republished with the connection live, and MathGPL has not been added inside ChatGPT.

## Steps
1. Switch the plugin import in `vite.config.ts` to the TanStack variant and confirm the `/mcp` route and OAuth metadata route are generated.
2. Activate the OAuth authorization server on the backend (one-time setup step).
3. Verify the consent screen approves/denies correctly and returns the teacher to ChatGPT.
4. Run the manifest extraction check and fix any tool errors it reports.
5. Republish the app so the live site serves the connection.
6. In ChatGPT: Settings → Connectors (or Developer mode → Create app) → add the MathGPT MCP URL (`https://mathgpl.com/mcp`), sign in as a teacher, approve access.
7. Test end-to-end in ChatGPT: "Show my workspace", "Create a lesson note on simultaneous equations with two worked questions", "Solve question 1" — and confirm results appear in the real MathGPL workspace.

## Technical notes
- Tools run as the signed-in teacher (their own data only); no public access, no shared keys.
- No changes to existing app features; this only opens the door for ChatGPT to call the tools that already exist.
- No AI credits are used by this setup work itself; ChatGPT-side usage follows the teacher's own ChatGPT plan.
