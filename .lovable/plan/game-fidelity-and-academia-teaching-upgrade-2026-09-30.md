# Game fidelity and Academia teaching upgrade

## Goal
Make shared Game play reproduce the creator’s saved Game exactly, repair its writing controls and Vaults, and expand Academia into a reusable teacher resource system without changing Courses.

## 1. Restore one-to-one Game fidelity
- Compare the same saved Game in Edit, signed-in Play, Academia Play, and guest-link Play.
- Make every path load the same saved background image/video, room, writing surfaces, decorations, rewards, lighting, and sound settings.
- Resolve private asset URLs for the recipient before rendering instead of relying on the creator’s browser state.
- Preserve uploaded background music, room tracks, reward sounds, volume, looping, and enabled/disabled choices.
- Remove fallback behavior that silently substitutes the first surface design or default scene values when the saved patterned slot exists.
- Keep sound non-blocking: the first permitted interaction unlocks playback, while unavailable audio never stops the Game.

## 2. Let the writing margin reach the surface edge
- Treat the margin as the text start position inside each physical writing surface.
- Allow it to move from the true left edge through the full existing rightward range on desktop, tablet, and phone.
- Remove the extra fixed inset that currently consumes too much of a narrow phone screen.
- Keep the surface number in its own reserved area so moving text left cannot cover it.
- Preserve each surface’s independent content-driven width, wrapping, and height.

## 3. Keep writing-surface numbers always visible
- Render Writing Surface 0, 1, 2, 3, and subsequent numbers in Edit, Play, Academia Play, and guest Play.
- Make the number visibility a Game invariant rather than an optional saved switch.
- Keep numbers readable against every saved surface material and prevent clipping at mobile widths.
- Preserve Line 0 as the read-only question and Lines 1 onward as solving lines.

## 4. Repair mathematical Vault activation
- Keep the existing rule: a Vault opens when the student enters the teacher’s encrypted mathematical expression in the same token order.
- Preserve mathematical symbols losslessly while normalising only harmless presentation differences such as spacing and equivalent operator glyphs.
- Match against the correct student line and correct saved reward instance, including older saved Vault formats.
- Permit activation while typing or after submission, but never award the line merely because a Vault opened.
- Add focused tests for repeated symbols, fractions, powers, physics/chemistry notation, multiple Vaults, wrong order, partial entry, and legacy Games.

## 5. Add the three teacher-only Session actions
Under every Academia Session, add exactly:

1. **Assign** — assign that Session’s activities to one or more classes in the teacher’s currently active workspace.
2. **Lesson Note** — the creator attaches or replaces the Session’s lesson note; permitted teachers can open it and copy it into their own workspace.
3. **Smartboard** — open only the attached lesson note in Smartboard presentation mode.

Rules:
- These actions appear only for teachers, never students.
- The creator and visiting teachers can assign to their own classes; they do not write into another teacher’s hidden Academia class.
- Only the Academia creator or an authorised subject builder can attach or replace the canonical lesson note.
- Copying creates an independent workspace copy with lineage retained; presenting does not alter the source note.

## 6. Add isolated Academia Session guest links
- Add a teacher control to create, copy, disable, and regenerate a link for one Session.
- The public page shows that Session’s title, video, attached lesson note presentation, and ordered activity cards in the same visual structure.
- Remove sibling-session navigation, hierarchy links, breadcrumbs, and APIs that could reveal another Session.
- Guests can complete Practice and Play for activities in that Session without creating an account.
- Create anonymous attempt identities scoped to the link and Session; never enrol guests into teacher classes or expose class rosters.
- Scope every guest Practice/Play lookup to both the link and activity so changing an identifier cannot open another Session or question.
- Keep normal Academia student access signed-in and direct; guest access exists only through this explicit Session link.

## 7. Bring Courses “Add Video” faithfully into Academia Practice and Play
- Reuse the existing video editor, timeline controls, line markers, locked saved state, player, and left/split/right presentation controls.
- Do not alter the Courses implementation.
- Add two independent video configurations to each Academia question card:
  - **Practice video** mapped one-to-one to the Practice question lines.
  - **Play video** mapped one-to-one to the Game question and solving lines.
- Only the uploading creator or authorised subject builder can add, edit, replace, or remove these videos.
- Teachers and students can test or play the saved presentation but cannot edit it without permission.
- Keep both panes mounted when switching left/split/right so video position and mathematical work are not reset.
- Make the same saved video mappings available through the isolated Session guest link.

## 8. Data and access model
- Extend Academia activities with separate Practice and Play video configurations and references to their stored media.
- Attach one canonical lesson note to a Session and store copied-note lineage through the existing notebook copy system.
- Add a dedicated Session guest-link scope and anonymous attempt records; do not reuse unrestricted class or Game links.
- Keep Academia media private and issue only narrowly scoped, time-limited access for a valid Session link.
- Preserve workspace, school, report, and subject-teacher isolation.
- Apply explicit grants and row-level access rules for every new table or policy path.

## 9. Verification
- Compare one saved Game in Edit, signed-in Play, Academia Play, and guest Play at laptop and 394px phone widths; background, music, surfaces, items, rewards, and settings must match.
- Confirm the margin reaches the physical surface edge and all surface numbers remain visible.
- Test Vault activation with exact order, wrong order, partial input, special notation, multiple Vaults, and legacy saves.
- Test Assign as the creator and as a visiting teacher; each can target only classes in their own active workspace.
- Attach a lesson note, open it in Smartboard, copy it, and confirm edits to the copy do not change the source.
- Open a Session guest link while signed out; complete Practice and Play, then attempt direct URLs for sibling Sessions and unrelated activities and confirm access is denied.
- Add different Practice and Play videos, map every line, and verify left/split/right playback for creator, teacher, student, and guest.
- Run focused automated tests, inspect mobile and desktop screens, and confirm no console, runtime, or current build errors.

## Not changing
Courses, the 3D Academy/Building system, the Math Engine, Floating Numbers mathematics, Game scoring rules, existing signed-in Academia navigation, or unrelated class/assignment workflows.
