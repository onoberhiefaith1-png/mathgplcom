## Technical detail

**Shared identity helper** — `src/lib/smartcards/smartCards.ts` already has
`CardIdentity`, `loadRememberedIdentity`, `rememberIdentity`,
`newParticipantKey`. Add one function, `ensurePlayerIdentity()`: signed-in user
→ their profile name; remembered guest → that name; otherwise mint
`newParticipantKey()` with the next default `User <n>` (counter kept in the same
local storage record) and persist it. Every public surface calls this one
function, so the name is identical on card, board and leaderboard.

**Smart Card page** — `src/pages/public/SmartCardPage.tsx`: add a "Playing as"
row above Start Challenge using the identity from `ensurePlayerIdentity()`, with
an inline edit field (max 40 chars) that writes back through
`rememberIdentity`. `open()` keeps its current navigation to
`/c/<slug>/solve` or `/c/<slug>/game`.

**Game Challenge** — `src/pages/public/SmartCardGamePage.tsx`: delete the
`if (!identity)` username form and the `guestName`/`authChecked` state; replace
the identity effect with `ensurePlayerIdentity()`. The existing name display in
the stage top bar becomes editable, same control as the challenge page.

**Challenge page** — `src/pages/public/SmartCardChallengePage.tsx`: swap its
inline identity effect for `ensurePlayerIdentity()`; its rename control and
`backTo="/c/<slug>"` stay as they are.

**Unchanged** — `/c/$slug`, `/c/$slug/solve`, `/c/$slug/game` are public routes
with no auth gate; `grade-line` already meters AI against the card owner via
`smartCardSlug` + `participantKey`. No schema change.

## Acceptance checks

- Opening the public link signed-out shows the card plus "Playing as User 1"
  with an edit control; no sign-in, no role choice.
- Editing the name persists and is the name the leaderboard shows.
- Start Challenge (normal and Game) lands on the board with no intermediate
  screen; Back returns to the same Smart Card.
- The signed-in teacher preview flow and the normal assignment flow behave
  exactly as now.
