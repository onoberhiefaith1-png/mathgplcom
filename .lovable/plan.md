## Goal

Put an **AI Settings gear at the top-right of the existing AI popover** (the rectangle that appears when you click AI on a section/Solution). Inside it, the teacher specifies exactly what they want from that solution — once — instead of retyping instructions every time.

Two layers:
- **Layer 1 (always on, invisible):** subject, topic, learning objectives, notation consistency, teaching-method continuity, prior-example continuity. Sent automatically on every call.
- **Layer 2 (teacher preferences):** the switches behind the gear.

---

## 1. Gear in the AI popover

`AiPopover.tsx` header row becomes: title on the left, small gear button on the right. Clicking the gear flips the popover body to a **Settings view** (same rectangle, no second popover), with a back arrow to return to the prompt view.

Settings view contents:
- **Style switches** (toggles): Step-by-step working, Simplify English, Real-life example, Scaffolded (hints before answer), Show formula first, Include common mistakes.
- **Depth**: Brief / Standard / Detailed.
- **Level**: free text (e.g. "SS2 / WAEC").
- **Standing instruction**: a persistent free-text box — "exactly what I want from every solution in this note".
- Reset to defaults.

Enabled switches also show as small chips in the prompt view so the teacher can see what's active without opening the gear.

## 2. Where preferences live

Per lesson note, saved in the browser (`localStorage`, keyed by notebook id) — no database migration, instant. A later cloud sync can be added without changing this UI.

## 3. Edit-in-place instead of appending

When AI runs in a section that already has content:
- Default action becomes **Edit / rewrite that content** using the active preferences (e.g. "make step-by-step + simplify"), replacing the section body rather than adding a second copy underneath.
- If the section is empty → generate new content.
- Existing Regenerate / Paraphrase / Extend / Clear footer actions stay and route to the same edit path.

## 4. Backend

`notebook-ai` accepts a new `preferences` object and a `mode: "generate" | "edit"`. Preferences are compiled into an appended prompt directive block; Layer‑1 context (`collectLessonContext`) continues to be injected first, so pedagogy, QUESTION_LOCK and continuity rules keep priority over teacher switches. Existing hygiene/integrity guards are untouched.

## Technical notes

- `src/components/lessonnotes/AiPopover.tsx`: add `settingsSlot` / internal view state, gear button, chips row.
- New `src/components/lessonnotes/ai/aiPreferences.ts`: type, defaults, load/save per notebook, and `buildPreferenceDirective()`.
- New `src/components/lessonnotes/ai/AiSettingsPanel.tsx`: the switch UI.
- `SectionHeading.tsx` / `DocumentEditor.tsx`: pass notebook id + preferences into `onGenerateSection`, and choose generate vs edit based on whether the section body is empty.
- `supabase/functions/notebook-ai/index.ts`: read `preferences` + `mode`, append directive after the pedagogy/continuity standards.
