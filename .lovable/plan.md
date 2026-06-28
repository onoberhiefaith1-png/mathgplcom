# Scope the per-section AI to its own section

## The bug

When a teacher opens the ✨ AI button on a section heading (e.g. *Introduction*) and types something like "add this, remove that", the current code runs the **generate** action. Generate ignores the existing section text and **appends** a freshly-written full section after it — and because the model rewrites the topic from scratch, the result feels like "it rewrote the whole lesson note." The four other sections were never touched in the document, but the regenerated content visually overwhelms everything.

What teachers actually expect: "edit only the section I opened the AI from."

## The fix (frontend only, no backend changes)

Update `handleSectionAi` in `src/components/lessonnotes/DocumentEditor.tsx` so a custom prompt on a section that already has content becomes an **in-place edit**, scoped strictly to that section's range:

1. If the section is **empty** → keep today's behavior (generate fresh content, append).
2. If the section has content AND the teacher typed a prompt → treat as **edit-in-place**:
   - Send the existing section text as `currentContent` plus a teacher instruction like *"Apply this change to the section below. Keep everything else the same. Output the full revised section only — no other sections, no headings."*
   - Replace the range `[headingEnd .. sectionEndPos]` with the AI response (same delete+insert path that `regenerate` already uses).
3. If the section has content AND the teacher typed nothing → keep today's behavior (append generated content) so the existing "extend / regenerate / paraphrase" footer buttons still mean what they say.

Section boundary detection (`computeSection` in `extensions/SectionHeading.tsx`) is already correct — it stops at the next heading of equal-or-higher level — so the replacement can never spill into neighboring sections.

## Files touched

- `src/components/lessonnotes/DocumentEditor.tsx` — branch `handleSectionAi` on "empty vs. has-content + has-prompt"; reuse the existing `regenerate` delete-and-insert path for the in-place edit.

No edge function, schema, or other section's code changes.

## Out of scope

- The global ribbon AI (whole-lesson) keeps its current behavior.
- Solution-block inheritance / QUESTION_LOCK logic is untouched.
- The Regenerate / Paraphrase / Extend / Clear footer actions keep their current meaning.
