## Technical notes

- The run happens in the live preview with an authenticated browser session (Playwright) against the Pilot panel — no new code paths, no test harness.
- It uses the existing procedure: `structure → material → analysing → blueprint → building`, with the draft questions and stable item IDs already added, so approved questions build verbatim and each keeps its linked solution.
- 20 question-bearing items means 20 blueprint questions plus 20 worked-solution generations. This consumes real AI credits and writes a real note plus a real Copilot session into the shared backend. The note is a clearly named throwaway and can be deleted afterwards.
- Nothing is changed during the test. Findings are reported as a list: what is professional, what is wrong, and a proposed fix for each. Any code change is a separate follow-up you approve.

## Deliverable

A written evaluation covering: draft quality, build completion and duration, solution fidelity to the classroom standard, rendering issues, question/solution linkage, plus screenshots of the draft card, the build progress, and the finished note.
