## Technical detail

**Storage (staged migration, applies when the draft is accepted)**
`aura_missions` — owner-scoped: `id`, `user_id`, `mission` text, `status` (`running` / `paused` / `done`), `ledger` jsonb (`known[]`, `unknown[]`, `tested[]`, `failed[]`, `questions[{id,text,status,answer}]`, `corrections[]`), `map` jsonb (area → `confirmed|uncertain|untouched`), `transcript` jsonb, timestamps. RLS owner-only plus `GRANT` for `authenticated`/`service_role`. Findings keep using `aura_knowledge` unchanged.

**Server** — `src/lib/agent/study.server.ts` becomes mission-driven:
- Each call loads the mission row, renders the ledger into the system prompt, and adds the standing instruction: *pick the single next action that most reduces your unknowns for this mission; skip anything the mission does not need.*
- Three new tools, gated to mission runs: `record_understanding` (patch ledger + map), `ask_supervisor` (append a pending question and return immediately — never blocks), `resolve_question`. Existing `propose_knowledge` still writes findings.
- Pending questions answered since the last stretch are injected as `corrections` at the top of the next stretch; unanswered ones are restated as still open.
- Loop budget stays bounded per stretch (`stepCountIs(16)`); the outer loop in `AuraProvider` continues until `MISSION COMPLETE`, the admin stops, or the ledger stops changing.
- `studyPolicy.ts` fence unchanged: writes only into `Practice — …` notebooks, real notes read-only, no assign/publish/share/delete, board claims only after `inspect_board_state`.

**Client** — `AuraProvider.tsx`: `study` context becomes `mission` with `mission`, `ledger`, `map`, `questions`, `answer(id, text)`, `start`, `pause`, `end`; live messages still stream into the cockpit panel. `AdminAuraTraining.tsx` is reorganised into Mission (input + start/pause/stop), Live activity, Exploration map, Open questions (inline reply), then the existing approval cards below.

**Naming** — the feature is called Autonomous System Exploration in code and UI; nothing implies model training.

**Untouched** — the maths engine, pedagogy rules, Floating Numbers generation, Smartboard, Game, and the assistant's model.

**Note on operating the UI:** her tools act through the platform's own server actions and navigation, not by driving a browser. She opens pages, reads real state back, and edits through the same paths a teacher uses. Anything she cannot reach that way she must report as unavailable rather than claim.
