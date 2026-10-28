# Imagine: mobile margin and content-driven surfaces

## What will change

- **Mobile margin line becomes draggable.** A teacher or student can drag the vertical line almost to the left edge using touch. Its position changes the real layout, so moving it left creates more usable mathematics space.
- **Number strip contracts with the margin.** The Q, 1, 2, 3 labels and their strip shrink proportionally while remaining readable and aligned. Together, the number strip and margin area will use no more than **5% of the writing surface** at the minimum position.
- **Desktop remains unchanged.** The existing desktop spacing and margin behaviour stay as they are.
- **Each surface grows with its own text.** Larger or longer mathematics expands that line’s surface to the right first. At the available screen limit, it wraps and grows downward. Erasing text lets it shrink again.
- **The surface—not the text—is flexible.** Increasing text size increases the surface before wrapping, so emphasis has visible impact without squeezing the mathematics.
- **Realistic skins remain lightweight.** Scroll, cloud and the other materials keep their CSS-only shapes. The scroll’s left edge remains fixed and its right roll follows the growing surface.

## Boundaries

- One mathematical solution line remains one writing surface.
- Existing question navigation, Floating Numbers, evaluation, rewards and the original 3D Game are unchanged.
- No heavy library, 3D object, blur effect or continuous decorative animation is added.