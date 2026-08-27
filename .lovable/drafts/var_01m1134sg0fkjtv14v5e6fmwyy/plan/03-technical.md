## Technical notes

All work stays in `src/pages/connections/RequestsPage.tsx`, `src/lib/connections/connections.ts`, `src/lib/connections/useConnections.ts`, plus one small settings component. No change to `request_connection`, `respond_to_connection`, `revoke_connection` or the Connections lens views.

**Incoming / Outgoing**
- Keep `useConnections("pending")` and the existing `direction` split; add a `useConnectionCounts()` pending badge on the Incoming tab, tab-specific empty copy, and a pending status line on outgoing rows. Query invalidation for accept/reject/withdraw already exists in `useConnectionActions`, so both sides refresh through the app's normal data layer.

**Rejected retention**
- The rejection time lives in `connections.responded_at` but `my_connections` does not return it, and the table has no Data API grants, so the app cannot read it today. Changing that function's return type is not an additive change, so instead a new SECURITY DEFINER function `my_rejected_requests()` returns the rejected rows for the signed-in participant with `responded_at`, granted to `authenticated`.
- Retention is stored as an additive `profiles.rejected_retention_hours` (default 24), read/written through the existing profile access path. The Rejected list filters client-side on `responded_at + retention > now()` and re-evaluates on a light interval, so rows disappear without a reload.
- Both database additions are staged as a migration in this draft and take effect when the draft is accepted; until then the Rejected tab keeps its current (non-expiring) behaviour and the retention menu will not persist.

**Community of Practice**
- A link button next to `ConnectByCodeDialog` to the existing discovery page (`/community/discover`), pre-scoped with the account's category exactly as the existing `discoverHref` helper does. No new discovery, request or connection code.

**Back navigation**
- Replace the `Link to="/"` header with the shared `BackButton` (`src/components/common/BackButton.tsx`), label "Back to Dashboard", fallback the signed-in role's dashboard from `WORKSPACE_PATH`/role nav (`/teaching-hub` teacher, `/school`, `/family`, `/student`). `BackButton` walks the real navigation stack, so arriving from any dashboard card returns there.

**Checks**
- Unit tests for the retention window (24h default, 3/5/7 day options, expiry measured from rejection) and for the incoming/outgoing direction split.
- Two live accounts driven through send → incoming → accept → both in Connections, and send → reject → appears in Rejected with a timestamp.
