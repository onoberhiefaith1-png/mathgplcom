## Implementation details

### Imagine-only saved sizes
- Extend Imagine’s existing presentation settings with independent desktop, tablet, and mobile size values, while retaining fallback to the current saved Game text sizes for older activities.
- Keep this inside the existing saved Game document; no database change is required.
- Do not change shared Game text limits, so the original 3D Game remains untouched.

### Teacher controls
- Keep the three controls in the existing right-side Imagine settings panel.
- Rename “Laptop” to “Desktop” for consistency.
- Use a piecewise slider mapping: the left half runs from the near-invisible minimum to today’s minimum; the right half runs from today’s minimum to today’s existing maximum.
- Show the actual effective pixel size beside each slider.

### Rendering and proportional surface scaling
- Resolve exactly one size from the active breakpoint: desktop, tablet, or mobile.
- Derive a lightweight CSS scale from that size. Apply it to each surface’s minimum dimensions, vertical spacing, and writing-area spacing while leaving content growth enabled.
- Keep the outside interaction area usable even when the visible surface becomes extremely small.
- Preserve wrapping and containment so mathematical text cannot escape the writing surface at any size.

### Compatibility
- Existing Imagine activities inherit their current desktop/tablet/mobile values without visual changes at first load.
- The play menu’s temporary student reading-size slider remains a multiplier and is not converted into three authoring controls.
- Structured mathematics, line selection, margin behavior, rewards, sounds, scoring, and Floating Numbers remain unchanged.

### Verification
- Add focused tests proving all three saved sizes are independent, the old minimum maps to the exact slider midpoint, and legacy activities retain their existing appearance.
- Verify teacher editing and saved reload at desktop, tablet, and phone widths.
- Visually confirm that the far-left setting makes both text and the visible surface extremely small, the midpoint matches today’s minimum, and larger settings retain content-driven surface growth.
- Confirm the original Game’s text sizing is unchanged.
