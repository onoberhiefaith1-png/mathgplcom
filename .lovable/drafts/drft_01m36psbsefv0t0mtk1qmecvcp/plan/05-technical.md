## Technical notes

**Agent surface.** New server-side hand modules registered in the existing
`AGENT_TOOL_MANIFEST` so the existing confirmation gate, step budget and step log apply
unchanged. Every new action gets a typed input/output schema, runs as the signed-in user
under RLS via the shared scoped client (`src/lib/db/scope.ts`), checks workspace ownership,
returns stable ids and explicit `ok` / `pending` / `failed` states, and pairs with a
read-back action. Writes take an idempotency key so a retry cannot duplicate a row, and
game saves carry the row's `updated_at` for a conflict check.

**Game hands** wrap the real `src/lib/slate/storage.ts`, `gameQuestions.ts`,
`gameAssignments.ts` — no second game engine, no second normaliser. `list_games` /
`link_game_to_class` are retargeted from the legacy `games` table to `slate_games`; the
legacy teaching-hub tools stay available under distinct names so nothing existing breaks.

**Media.** Image generation reuses the existing gateway image path already proven by
`generate-game-cover`. Video is a new server route creating one job per explicit approval
on the gateway video endpoint, polled for status, with the finished MP4 stored privately
and captions saved alongside. Nothing is generated on page load, and a failed job is never
auto-resubmitted.

**New data (staged as additive migrations, applied when this draft is accepted).**
A media library table (owner, workspace, kind, storage path, provenance, rights, duration,
dimensions, description, created_at) with grants and owner-scoped RLS; a usage table
linking an asset to the game and placement using it; an agent action audit table (actor,
action, target, args digest, outcome, cost); a spend record per approved generation. The
hidden test class uses ordinary class records flagged as test material, so it behaves like
any class while being visibly not real.

**Server-side reward integrity.** A server write path for Slate Game results so a reward
cannot be recorded without server-confirmed full marks and cannot be recorded twice;
existing client best-score behaviour is preserved for what it already does correctly.

**Out of scope here.** Adventures (next delivery, same spine), branching adventures (does
not exist in the app), purchases or redeemable currency, and voice cloning.
