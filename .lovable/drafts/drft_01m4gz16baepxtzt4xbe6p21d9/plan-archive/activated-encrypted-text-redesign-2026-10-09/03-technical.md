## Implementation

1. Pass the activated Vault expression through the existing structured mathematics renderer instead of printing the source string directly. Fractions, powers, roots, brackets, and symbols will display in their proper mathematical form.
2. Replace the black panel and heavy bold treatment with a light premium face, a fine contrasting edge, and a shallow layered shadow that suggests width and depth without becoming full 3D.
3. Keep the reveal animation lightweight and readable, with responsive sizing and containment for long expressions on phones and laptops.
4. Preserve the existing Vault activation order, matching logic, timing, reward consumption, and stored expression exactly.

## Verification

- Add a focused check proving `\\frac{15}{3}` renders as structured mathematics and never as visible raw syntax.
- Check common expressions including powers, roots, brackets, operators, and longer equations.
- Verify contrast and fit at phone and desktop sizes during an actual Game Vault activation.
- Run the existing Game reward tests and code checks to confirm activation behavior is unchanged.

No AI generation or AI credits are required for this work.
