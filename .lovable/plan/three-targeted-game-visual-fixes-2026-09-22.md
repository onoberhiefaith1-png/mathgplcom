# Three targeted Game visual fixes

## 1. Make the sensor control unmistakably visible
- Restyle only the Game sensor controller to match the supplied gold-and-navy 3D control: connected directional body, metallic depth, blue illuminated seams, strong raised arrow keys, and the illuminated sensor mark in the centre.
- Keep the existing four-direction sensor behavior unchanged: left/right remain available, up/down remain dim until a valid mathematical destination exists, and dragging still works.
- Show it at full visibility when the Game opens so students notice it immediately; retain its existing inactivity fade afterward.
- Keep it clear of the writing surfaces, rewards, Floating Numbers strip, and top status bar on desktop, tablet, and phone.

## 2. Put the premium bomb under the shared reward visibility settings
- Pass the saved Reward opacity into the premium spherical bomb body instead of letting its solid 3D materials bypass that setting.
- Apply opacity consistently to the bomb shell, rings, core, lights, and dormant presentation so lowering opacity makes the whole reward fade/blur with every other reward.
- Respect the existing Reward Visible switch for this bomb exactly as for the other rewards.
- Preserve the bomb’s artwork, animation, activation, sound, chaining, and reward behavior.

## 3. Use the real reward artwork in the Game status bar
- Replace the drawn TIME Hourglass icon with the existing Game Hourglass artwork.
- Replace the drawn LIFE heart icon with the existing Game Life artwork.
- Keep the existing real Vault and Completion artwork, counts, timers, labels, and layout.
- Use compact, consistently sized images that remain clear without shifting or overflowing the top bar.

## Verification
- Open the Game and confirm the 3D four-arrow sensor control is prominent immediately, with contextual disabled up/down states still correct.
- Move Reward opacity from full to low and toggle Reward Visible; confirm the premium bomb follows both settings together with all other reward objects.
- Confirm TIME, LIFE, VAULT, and COMPLETION each show their actual Game artwork in desktop and narrow/mobile status layouts.
- Confirm sensor movement, grading, Vault matching, reward activation, sounds, timers, and the Game world remain unchanged.
