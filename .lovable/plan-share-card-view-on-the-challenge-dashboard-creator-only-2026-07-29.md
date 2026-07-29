# Share Card view on the Challenge Dashboard (creator only)

Add a creator-only promotional view to the published Challenge Dashboard (`/c/:slug?creator=1`). It exists purely so the teacher can take an attractive screenshot to post alongside the link. The public challenge page never changes.

## Toolbar control

Next to Copy Smart Card / Share Smart Card, add a button visible only when `creator=1`:

- Normal view: **Create Share Card**
- While active: **Back to Dashboard**

No navigation, no new page, no persistence of the view itself — the dashboard always opens in Normal view.

## Normal view (unchanged)

Card with title, question, Start Challenge button; statistics row below the card; leaderboard below that. Untouched for students and visitors.

## Share Card view

Same card, transformed in place:

1. The four live counters (Total Players, Perfect Scores, Solving Now, Visitors) move from below the card into the card, directly under the title and above the question. Same live values from the same state — moved, not duplicated. The counters section below the card is hidden while active.
2. The Start Challenge button is replaced by an editable promotional message, e.g. the default `👇 Use the link below to solve today's challenge.` Click the text to edit it inline; it renders as plain styled text otherwise.
3. Everything else in the card (banner label, chips, question rendering, diagrams) stays identical. The question block stops behaving as a clickable "start" target while in this view.
4. Leaderboard and the Copy/Share toolbar remain available so the teacher can grab the link straight after the screenshot.
5. Turning it off instantly restores the counters below the card and the Start Challenge button. Nothing is lost.

The promotional message is independent of the challenge: it never touches the question, answer, marks, URL, leaderboard, or statistics.

## Technical notes

- All changes are confined to `src/pages/public/SmartCardPage.tsx`, plus a small `ShareCounters`/promo-message block (kept in the same file or a sibling component under `src/components/smartcards/`).
- New local state: `shareMode: boolean` and `promoText: string`. The counters array already exists; it is rendered in one of two positions based on `shareMode`.
- `promoText` persists per card in `localStorage` under a `smartcard:promo:<slug>` key so the teacher's wording survives a refresh. No database change, no edge-function change, no change to `smartCards.ts` payloads.
- Gated by the existing `creator` flag derived from the `?creator=1` search param — anonymous visitors render exactly the current markup.
