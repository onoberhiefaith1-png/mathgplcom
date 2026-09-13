# MATHGPL

Create a cinematic 3D interactive landing scene featuring a rotating five-sided mathematical academy.

STRUCTURE:
Build a 3D circular layout made of five large vertical panels arranged evenly in a pentagon formation (72° apart). Each panel represents one subject and uses a full-screen high-resolution image:

Algebra

Geometry

Trigonometry

Statistics

Calculus

All panels must have identical dimensions, perspective, and alignment so they appear as one continuous architectural structure when rotating.

CAMERA & PERSPECTIVE:
Use a fixed central camera positioned slightly below eye level, facing the structure. The perspective should emphasize scale and depth, making the building feel massive and immersive.

ROTATION:
The structure rotates horizontally (Y-axis) in a smooth continuous loop.

Speed: one full rotation every 25 seconds

Easing: linear, no jerks or sudden changes

Direction: clockwise

The rotation must feel cinematic and fluid

INTERACTION:
Each panel is fully clickable.

On hover:

Rotation slows down by 40%

The hovered panel slightly scales up (1.05x)

Add a soft glow or highlight around the panel

On click:

Stop rotation smoothly

Camera zooms into the selected panel (smooth transition, 0.8–1.2 seconds)

Then navigate to the corresponding subject page

VISUAL CONTINUITY:
Ensure all five images:

Share the same lighting tone (golden hour, warm glow)

Have matching horizon line and perspective

Blend seamlessly so rotation feels like one single building

ENVIRONMENT:

Background: soft gradient sky (orange, purple, blue tones)

Add subtle floating light particles around the structure

Add faint ambient glow around the base

Optional: soft reflective floor beneath for depth

PERFORMANCE:

Optimize for smooth rendering (target 60fps)

Use efficient 3D rendering (WebGL / Three.js style)

Ensure responsiveness on desktop and tablet

CONSTRAINTS:

No human characters

No UI clutter

No text overlays except what exists inside the images

Keep focus entirely on the rotating structure

GOAL:
The final experience should feel like a high-end cinematic game menu where a massive mathematical palace rotates in space, and each side is an interactive gateway.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mathgplcom.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/30005c61-7d1d-463b-a876-44cb40d4a564).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
