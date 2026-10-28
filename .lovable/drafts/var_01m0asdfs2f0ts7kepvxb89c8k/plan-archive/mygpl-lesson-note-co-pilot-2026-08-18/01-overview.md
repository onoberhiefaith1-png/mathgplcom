# MyGPL Lesson Note Co-Pilot

A conversational teaching assistant docked inside the Lesson Note. It reads the real note, discusses, proposes, waits for approval, then drives the **existing** MyGPL functions — it never becomes a second generator.

## Interface

- A **MyGPL Co-Pilot** button in the Lesson Note top bar. Closed by default.
- Opens as a right-hand dock at roughly one third of the screen; the note keeps the rest and stays fully editable while the Co-Pilot is open. A collapse control returns the note to full screen; the panel width is remembered per session.
- Chat transcript, not a form: typed messages, pasted text, and voice notes (the existing dictation hook already used by the AI panels).
- A **PLAN / CREATE** switch at the top of the composer. PLAN always answers with analysis and a proposal only. CREATE may act immediately for small additive work, but anything that replaces, deletes or rewrites existing content still shows a one-line confirmation.

## Interaction model

Every turn ends in one of three shapes:

1. **Discussion** — plain answer, nothing touched.
2. **Proposal** — what it will change, which section it touches, what it preserves, and Approve / Reject buttons.
3. **Implementation** — only after Approve: a live checklist of steps ("Reading Example 2…", "Checking difficulty…", "Generating worked solution…", "Updating lesson note…", "Completed"), each step ticking as it finishes, with a failure named by step if one stops.

Rejecting keeps the conversation going; nothing in the note changes.
