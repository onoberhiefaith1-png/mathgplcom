# Blank-by-default input fields across MathGPL

## What I found

The Create Game dialog's Title / Topic / Subtopic fields are already empty on a new game — the "Quadratic Equations", "Algebra", "Quadratic Formula" text you see is *placeholder* text, not real content. The problem is that on that dark dialog the placeholder is rendered in a colour that is nearly as bright as typed text, so it reads as a pre-filled value. If you pressed Save with the fields untouched, the game would be named "Untitled Game", not "Quadratic Equations".

A platform scan also turned up a small number of fields that genuinely start with example/sample content rather than a placeholder.

## What will change

1. **Make placeholders unmistakably hints, not values.** One global placeholder treatment (clearly dimmer than typed text, and italic in dark surfaces) applied to the shared Input, Textarea and content-editable field styles, so a hint can never be mistaken for data on any screen — light or dark.

2. **Remove genuine sample content from fields.** The audit found real pre-filled values, which become empty fields with placeholders instead:
   - Matrix toolbar row-operation field (currently starts as `R2 = R2 - R1`).
   - Lesson-note practice/hint field in the LCM game screen (starts with a long sentence of instruction text) — moved to helper text under the field.
   - Any remaining field where a non-empty string is the initial state and the user is expected to type over it.
   Fields whose default is a real business value (score label "Marks", group names "Group A", "Untitled Game" as a save fallback) are kept — those are defaults, not examples.

3. **Confirm edit mode still loads saved data.** Create flows start blank; open-existing flows keep loading the stored title/topic/subtopic and other values, exactly as today.

4. **Write the rule down** so future forms follow it: new form = blank fields + placeholder/helper text; edit form = load saved values; never seed an input with example text.

## Audit scope

Every input surface in the app is checked for seeded example content: lesson notes, game/adventure/video-adventure creation and editors, classes, schools, teachers, parents, students, community, admin console, AI tools, settings and profile pages, plus all dialogs and popovers.

## Technical notes

- Placeholder styling centralised in `src/components/ui/input.tsx`, `textarea.tsx` and the shared field class in `src/styles.css` (a dedicated `placeholder:` token instead of `text-muted-foreground`), so no per-screen overrides are needed.
- Audit method: search for non-empty `useState("…")` initial values bound to `value=` on inputs, plus `defaultValue="…"`, across `src/pages` and `src/components`; each hit is classified as example text (removed) or real default (kept).
- No backend, schema or save-logic changes.
