# Keep ChatGPT connected through website sign-outs

## What the code shows (confirmed by reading it)
- The website has an automatic sign-out after 15 minutes away (`useIdleSignOut`). It's only one of several sign-out paths. All of them call the backend sign-out with its default setting, which is "sign out everywhere":
  - the Account menu sign-out (`signOutEverywhere.ts`, `AuthProvider.tsx`)
  - the 15-minute idle sign-out (same routine)
  - the "Remember me unticked" sign-out when the browser reopens (`AuthProvider.tsx`)
  - full sign-out (`sessionReset.ts`) and leaving view-as (`impersonation.ts`)
- "Sign out everywhere" ends every sign-in session that teacher has. The sign-in ChatGPT receives when a teacher approves it is one of those sessions. Once it ends, its renewal key is deleted, and ChatGPT's next renewal fails with `refresh_token_not_found`. That matches the error from the earlier diagnosis.
- Only one path already signs out of this browser alone (`useAccount.ts`, `scope: "local"`).
- Sign-in settings look fine: approval page, client registration, site address and allowed return addresses all check out. Token lifetime and renewal handling are left as they are.

## How sure this is
- Likely cause, not proven. Only sign-in logs from the last few hours are kept, and they show no sign-out event, so I can't tie a specific website sign-out to the earlier failure. The plan therefore starts with a live check (Test 4 below) before and after the change.
- The 15-minute timer is just one trigger. Any website sign-out, including a manual one, would disconnect ChatGPT.

## Changes (smallest necessary)
1. Website sign-out signs out this browser only. Every path above passes `{ scope: "local" }`. ChatGPT's separately approved session stays valid, and so do the teacher's other devices. The 15-minute rule, "Remember me", account clearing and view-as all keep working as they do now.
2. Add a Disconnect ChatGPT control in the Account menu. It lists approved apps (`supabase.auth.oauth.listGrants`) and revokes one (`revokeGrant`). Revoking ends ChatGPT's tokens and renewals.
3. Clear reconnect message. When the MCP sign-in check fails, tools return "Your MathGPL connection has expired or was disconnected. Reconnect MathGPL in ChatGPT settings." plus the existing reason code. Normal expiry is unchanged: access tokens stay short-lived, and there are no permanent tokens.
4. Tool access isn't touched. It still comes from the verified token only, with the teacher's own row-level rules and owner filters.

## Tests
- Automated: every sign-out path uses this-browser-only sign-out, the reconnect message appears for each failure reason, and the existing 42 connector/ownership/isolation tests still pass.
- Live checks I can run in the preview as the signed-in teacher: list and revoke approved apps; local sign-out leaves a second session working.
- Need you in ChatGPT after you publish (I can't drive ChatGPT):
  1. Connect and approve.
  2. Run list_notebooks.
  3. Leave the site hidden for more than 15 minutes, then run list_notebooks again.
  4. Sign out on mathgpl.com, then run list_notebooks. It should still work, which confirms the cause.
  5. Wait more than one hour so the access token renews, then run list_notebooks.
  6. Disconnect in the Account menu. The next call should show the reconnect message.
  7. With your explicit permission, create and update one test note.
  8. Repeat with a second test teacher, and confirm neither teacher sees the other's notes.

## Not changing
No new plugin, server or site. No change to token lifetime, the approval page, the database or unrelated features. Nothing gets published by me.
