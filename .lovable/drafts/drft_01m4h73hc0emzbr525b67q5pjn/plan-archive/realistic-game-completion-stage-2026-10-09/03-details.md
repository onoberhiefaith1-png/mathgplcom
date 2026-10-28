## Reward fidelity
The results board will reuse the Game’s actual artwork, not generic line icons:

- **Marks:** the existing gold mark seal
- **Completion coins:** the existing completion reward artwork
- **Vault reward / Vaults opened:** the existing closed/open Vault artwork
- **Lives gained or used:** the existing jeweled Life artwork
- **Time earned:** the existing Hourglass artwork when time was earned

Only rewards relevant to that question appear. Every number is read from the completed question’s authoritative reward summary; the animation changes presentation only and never changes marks or payouts.

## Question progress and actions
Add a clear `Question N of Total` indicator to the result stage. Normal Games retain all Levels. Academia Play still completes one linked Game question at a time, then its Continue action moves through the Session’s ordered activities.

Continue uses the bold green treatment in the reference. Exit uses the bold blue treatment and the familiar exit symbol. Both remain large touch targets, including on phone layouts.

## Technical details
- Replace the current translucent card and generic icons inside the reusable Game completion scene.
- Reuse bundled transparent reward images so the display matches objects already seen during play.
- Add small CSS-only star, count-up, shimmer, and confetti motion; no heavy canvas or 3D scene is introduced.
- Pass question index and total from the existing Game runtime into the scene.
- Keep all existing Flow outcome selection and Game-background behavior unchanged.
- Add focused tests for counter completion, reward visibility, question progress, and reduced-motion final state.
- Verify visually at desktop and phone sizes, including long reward values and Flow-character placement.

## Acceptance checks
- Stars illuminate one at a time in the correct order.
- Marks count from 0 to the earned mark; coin, Vault, Life, and time totals each count from 0 to their exact earned values.
- No invented reward appears, and zero-only rows stay hidden except the marks row.
- The Game’s own world remains visible behind the celebration stage.
- Continue never advances before the student chooses it; Exit leaves correctly.
- The completed screen stays clear and responsive without slowing gameplay.
