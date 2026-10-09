## Build sequence

1. **Replace Game II with Imagine**
   - Remove Game II pages, labels, and navigation entries.
   - Add `/imagine`, `/imagine/play/:gameId`, and `/imagine/edit/:gameId` with Imagine-specific titles and descriptions.
   - Add Imagine to the left navigation for teachers, shared-workspace teachers, and students.

2. **Create an independent 2D Imagine editor**
   - Build and edit without ever navigating to `/game/slate`.
   - Let teachers choose the background, writing-surface appearance, line count, text settings, sounds, rewards, and existing game rules in a flat preview.
   - Reuse the established game records and question assignments so teachers do not rebuild existing games.

3. **Build the Smartboard-first player**
   - Use the existing Smartboard/Floating Numbers board behavior as the interaction foundation, not the current 3D scene with a card list placed over it.
   - Render the chosen background behind a responsive writing surface and use native scrolling/line movement.
   - Preserve question order and levels for normal Imagine play; Academia continues to open only its linked individual question.
   - Preserve instant predictive grading, evaluation, marks, persistence, class scope, guest access, sounds, timer, lives, score, Vaults, and completion reports.

4. **Separate celebration from gameplay**
   - Keep background, writing, controls, and rewards as independently updating layers.
   - Send reward events through a bounded queue rendered above the board with no pointer capture.
   - Advance the line as soon as grading succeeds; never wait for animation or audio.
   - Respect reduced-motion and automatically simplify effects on slower devices.

5. **Connect all Imagine entry points**
   - Teacher Imagine library: Create, Edit, Preview, Assign, Play, Delete.
   - Student left navigation: assigned Imagine games and saved progress only.
   - Shared dashboard/class links and Imagine guest links open the Imagine player, never the 3D Game.
   - Empty games remain in the Imagine editor instead of falling back to the 3D board.

## Technical boundaries
- No `three.js`, WebGL canvas, 3D room, world camera, physics, lighting, or 3D asset import in Imagine.
- Do not change the existing Game pages or its 3D behavior.
- Share stable game rules and data services; keep Imagine presentation components separate so future Game changes cannot reintroduce 3D weight.
- Rename the architecture rule from Game II to Imagine and keep this separation explicit.

## Verification
- Compare first input response, line switching, and reward activation with the Smartboard on phone, tablet, laptop, and classroom-width displays.
- Confirm text remains inside the writing surface at minimum and maximum text size.
- Confirm correct-line grading advances immediately while multiple rewards and sounds are still active.
- Confirm Create, Edit, Preview, assigned student play, Academia single-question play, and guest play never enter a `/game` or `/game/slate` page.
- Confirm the original 3D Game still opens and behaves exactly as before.
