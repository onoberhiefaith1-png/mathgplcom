# Diagnosis: ChatGPT echo / list_notebooks return -32603 after deploy

## Evidence (read-only, no secrets)
- Live server log, last hour: every /mcp request is an unauthenticated 401 (`auth.no_bearer_token`) — at 04:39 (2 GET, 2 POST) and 04:51 (your public GET). No signed /mcp call, no tool run, no server exception was logged after the 04:49 deploy. So the -32603 failures never reached MathGPL's code.
- Sign-in service log: three ChatGPT token refreshes (`POST /oauth/token`, referer mathgpl.com) at 04:50:17, 04:50:47, 04:50:52 all failed `400 refresh_token_not_found`. Seconds later (04:51:08 and 04:51:11) the sign-in service reloaded its configuration.
- No other server errors in the last hour.

## Root cause
The ChatGPT connection's saved sign-in has expired and its renewal key is no longer recognised. ChatGPT tried to renew it three times, was refused each time, and reported that to you as the generic -32603 "Internal error" without ever sending the tool call. This is not a code exception, and the logs don't show stale code either: no signed request reached the new build, so its `mcp-auth-sub-v2` marker hasn't been tested yet.

## Smallest supported remedy (no code change)
1. In ChatGPT, open Settings > Apps/Connectors > MathGPL, choose Disconnect, then Connect again and sign in as the teacher. The OAuth approval page should open with its authorization_id.
2. Call `echo({text:"x"})` first. If it reports `build: "mcp-auth-sub-v2"`, the new code is live.
3. Then call `list_notebooks`. If it still fails, its reason (`no_verified_context` / `missing_subject` / `missing_token`) shows which check failed, and I'll read that request's logs.

## Not done
- No edits or deployments. Unrelated work and the Chemistry draft are untouched.
- One thing I can't confirm: whether the sign-in configuration reload at 04:51 cleared old renewal keys, or only happened at the same time.
