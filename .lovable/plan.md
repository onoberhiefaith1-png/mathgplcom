# Fix ChatGPT "Not authenticated" on create_notebook (diagnosis + narrow fix)

## What the code shows

- **`/mcp` always needs a verified sign-in.** In `@lovable.dev/mcp-js` 0.20.1 (`dist/chunk-M35C7Y3M.js`), a call with no bearer token is rejected with 401 before any tool runs. The token is checked against the issuer, the `authenticated` audience, its `sub`, and the OAuth `client_id` claim (set up in `src/lib/mcp/index.ts`). So when `create_notebook` runs, `ctx.isAuthenticated()` is always true, and `ctx.getUserId()` holds the verified teacher id.
- **Where the message comes from.** "Not authenticated" can only come from `requireUser` in `src/lib/mcp/supabase-user.ts`. Nothing in the database raises that text, and the SDK doesn't produce `INVALID_ARGUMENT`; ChatGPT labels any `isError` result that way.
- **The weak step.** After the SDK has already verified the token, `requireUser` makes a second network call, `client.auth.getUser()`, through `SUPABASE_URL`. It then discards that call's `error`:
  ```ts
  const { data: me } = await client.auth.getUser();
  if (!me.user) return { error: "Not authenticated" };
  ```
  Any failure of that extra call turns into "Not authenticated", and the real reason is lost. Possible failures: a slow or failed request, rate limiting, the proxy, or the auth service rejecting this OAuth token on its `/user` endpoint.
- **The same step runs before every tool.** `workspace_snapshot`, `list_notebooks` (its own copy in `tools/list-notebooks.ts`), `create_notebook` and all wrapped action tools (`tools/agent-actions.ts`) repeat it. That's why reads passed and `create_notebook` failed: the per-call lookup is unreliable, not the teacher's session.

## Root cause (code-confirmed; the exact failure wasn't seen in logs)

Every MCP tool depends on a redundant, unguarded `auth.getUser()` round-trip in `src/lib/mcp/supabase-user.ts` that throws away its error. When that lookup fails, a correctly verified ChatGPT call is reported as "Not authenticated". The backend auth and API logs for the last few hours came back empty, so I couldn't confirm which failure happened. Signing in again won't fix this: the next call goes through the same fragile check.

## Separate item: empty lists

The empty `list_notebooks` and `workspace_snapshot` results are real successful reads, filtered by `owner_id` and `class_members` for the verified user. They're empty either because this teacher genuinely has nothing matching, or because the database didn't see the OAuth token as that user. Step 3 checks which. It doesn't block the fix.

## Narrow fix (after approval)

1. **`src/lib/mcp/supabase-user.ts`**, in `requireUser`:
   - Take `userId` from `ctx.getUserId()`, the SDK-verified `sub`, instead of `getUser()`.
   - Keep the caller-token client unchanged, so the database's row rules still apply to every read and write.
   - Return "Not authenticated" only when the verified context or `sub` is missing.
   - Never take the identity from tool input. Nothing uses the service key.
2. **`src/lib/mcp/tools/list-notebooks.ts`**: remove its duplicate client and `getUser()` check and use the shared `requireUser`, so all tools behave the same way.
3. **Check the empty lists** with a read-only query of row counts for the connected teacher, with no ids or tokens shown. Report whether the lists are genuinely empty or the database isn't seeing the token as that teacher. No database or rule changes in this task.
4. **Tests** in `src/lib/mcp/__tests__/mcp.test.ts`:
   - With a verified context and a failing `getUser`, `create_notebook` still inserts with `owner_id` equal to the verified `sub`.
   - With no verified context, it still returns "Not authenticated".
   - An `owner_id` or user id passed in the tool input is ignored.
5. Run the MCP tests and the type check, and regenerate the MCP manifest (still 63 tools). No deploy or publish, no backend or production changes, and the pending Chemistry draft stays untouched.

## After it's published (owner)

Reconnect isn't required. In ChatGPT, call `create_notebook` with a short title, then confirm the notebook shows up in MathGPL and in `list_notebooks`.
