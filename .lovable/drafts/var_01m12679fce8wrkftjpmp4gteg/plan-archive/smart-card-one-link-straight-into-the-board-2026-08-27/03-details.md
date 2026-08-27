## Technical detail

**Remove sharing** — `src/pages/public/SmartCardPage.tsx`: drop the Share Smart Card button, the `shareCard` handler, the `shareOpen` state and the `ShareSheet` import/render. Delete `src/components/public/ShareSheet.tsx`. The creator-only "Create Share Card" screenshot view and the promo message are a different feature and stay as they are.

**Copy Smart Card** — keep the same button, harden the handler: try `navigator.clipboard.writeText(link)`, fall back to a hidden textarea + `document.execCommand('copy')` when the clipboard API is unavailable or throws, and surface a short "Link copied" confirmation (or "Copy failed — select the link" if both paths fail). `link` already comes from `shareUrl(slug)` → `publicOrigin()`, which resolves to `https://mathgpl.com/c/<slug>`, so the copied string is only that URL.

**Skip the guest gate** — `src/pages/public/SmartCardChallengePage.tsx` currently blocks the board on an `identity` state and renders the Welcome / Continue as Guest / Sign in to Smartboard card. Replace that gate: on mount, use the remembered identity or a signed-in user's name when present, otherwise mint a `newParticipantKey()` with an auto display name (e.g. `Guest 4821`) and go straight to the board. Nothing is persisted server-side beyond the existing per-card progress row. Renaming stays available through the existing "Switch player" control in the top bar, which becomes an optional name field rather than a wall.

**Back to Smart Card** — `PresentationView` renders one `BackButton` in assessment mode with no explicit target, so it walks nav history. Add an optional `backTo`/`backLabel` prop, passed only from the public challenge page as `/c/<slug>` and "Back to Smart Card"; when absent, behaviour is byte-for-byte the current one, so the Assignment flow is unchanged. Also add the same link to the public challenge top bar so it is reachable even when the board chrome is hidden.

**Untouched and verified** — `/c/$slug` and `/c/$slug/solve` are public routes with no auth guard; `grade-line` already accepts `smartCardSlug` + `participantKey` for unauthenticated callers, validates the card is published and matches the assessment, and meters AI usage against `assessment.owner_id` (the teacher). No schema change is needed. "Visit MathGPL" in the footer stays.

## Acceptance checks

- Copy pastes only `https://mathgpl.com/c/<slug>`; confirmation appears.
- That URL, opened signed-out, shows the card — no login, no sign-up.
- Start Challenge lands on the student Smart Board with the teacher's lines loaded, no intermediate screen.
- Marking, line progression and video behave as now; AI usage bills the card owner.
- Back on the public board returns to the same Smart Card.
- A logged-in student in the normal Assignment flow still returns to the Assignment Dashboard.
