# Complete the Requests page

Requests keeps its current look, tabs and Connections behaviour. What changes is that Incoming, Outgoing and Rejected become properly useful, Community of Practice sits next to Connect with a code, and the back link points at the dashboard the teacher came from.

## What is already true today

- Incoming and Outgoing already read the same real request data (`my_connections`) and already offer Accept, Decline and Withdraw — they are not fake. They are thin: a bare "Nothing here yet" for both, no pending counts on the tabs, and Outgoing gives no sense of what is still waiting.
- Rejected already lists rejected requests, but forever: the rejection time is recorded in the database and is not sent to the app, so nothing can expire.
- Connect with a code works and stays exactly as it is.
- Community discovery (the Community of Practice used by Go Live) already exists at its own page and is what will be reused — no second version.

## What gets built

1. **Incoming** — same rows and actions, plus a live pending count on the tab, per-tab empty text that says what the tab means, and an explicit "Waiting for you" line. Requests arriving by Share Code, by Community of Practice or any other route all land here, because they are all the same request record.
2. **Outgoing** — pending sent requests, each showing who it went to and when, and a "Waiting for them to accept" state next to Withdraw. On acceptance it leaves Outgoing and appears in Connections automatically.
3. **Rejected** — a temporary list. Each row shows when it was rejected and disappears on its own after the retention period. Default 24 hours.
4. **Retention control** — a small settings icon on the Rejected tab: 24 hours (default), 3 days, 5 days, 7 days. Expiry counts from the moment of rejection, so changing the setting immediately changes what is still visible.
5. **Community of Practice** — a button beside Connect with a code that opens the existing Community discovery, carrying the account's own role/category as it already does elsewhere on this page. Requests sent from there appear in the sender's Outgoing and the recipient's Incoming like any other.
6. **Back link** — reads "Back to Dashboard" and returns to the dashboard actually navigated from, falling back to the signed-in role's dashboard (teacher, school, parent, student) rather than the building.

Nothing shows a cross, "failed" or error language for a rejection. A rejected request is simply an answered request.
