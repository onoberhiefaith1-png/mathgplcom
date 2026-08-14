# Lesson Note Structure: 7 Sections, Custom Sessions, Subtopics

## 1. Final section menu

The Section menu becomes exactly seven items, in this order:

1. Introduction — no solution
2. Explanation — no solution
3. Example — with solution
4. Exercise — with solution
5. Classwork — with solution
6. Homework — with solution
7. Summary — no solution

Objectives and Assessment are removed from the menu. Existing notes that already contain those headings keep rendering and stay AI-editable; only the insert menu drops them.

## 2. Below Summary: two structural controls

Under the seven items the menu shows a separator and two actions that are not lesson sections:

```text
Introduction
Explanation
Example
Exercise
Classwork
Homework
Summary
──────────────────
+ Add Session
+ Add Subtopic
```

### + Add Session

Clicking it opens a small inline bar:

```text
Add Session: [ Factorising Quadratic Expressions ]   ( With Solution | Without Solution )
```

The teacher types the name, picks With / Without Solution (With Solution is preselected), and presses Enter. On Enter a new section is committed onto the note at the end of the current subtopic:

- With Solution → the session heading, an empty content area, then a Solution area beneath it.
- Without Solution → the session heading and content area only, no solution area.

The session is its own section: it is not inside Summary and not inside the previous session. Escape cancels; an empty name does nothing.

### + Add Subtopic

Clicking it opens:

```text
Subtopic: [ Adding Fractions with Different Denominators ]
```

Enter creates a subtopic heading (a level above the section headings). Everything inserted after it belongs to that subtopic until the next subtopic heading.

## 3. AI behaviour

**Custom sessions.** The typed session name is stored on the section and becomes the AI instruction for it. "Add Session: Find the LCM of 12 and 18" generates content for exactly that request, not a generic LCM section. A With Solution session behaves like Example/Exercise: question first, solution generated into the solution area, Floating-Number prep and the existing QUESTION_LOCK / inheritance rules apply unchanged. A Without Solution session generates content only and no solution area is created.

**Subtopic scoping.** The AI context for any generation is resolved from the nearest subtopic heading above the insertion point:

```text
Main Topic:      Fractions            (from the notebook)
Current Subtopic: Adding Fractions with Different Denominators   (nearest heading above)
```

Pressing Introduction, Explanation, Example, Exercise, Classwork, Homework, Summary or a custom session under Subtopic 2 generates for Subtopic 2 only. The lesson-history context the AI receives is likewise limited to sections inside the current subtopic, so content never continues the previous subtopic. When no subtopic heading exists, behaviour is exactly as today (notebook subtopic is used).

## Technical notes

- `src/lib/lessonnotes/sectionKinds.ts`: new kinds `subtopic` and `custom_session`; trim the insert-menu list to the seven sections (keep `objectives`/`assessment` in labels and `detectSectionKind` for backward compatibility); map `custom_session` to `example` for the edge function and `blockKindFor` to `solution` only when the teacher chose With Solution.
- `src/components/lessonnotes/DocumentEditor.tsx`: replace `SECTION_OPTIONS` with the 7-item list plus the two structural entries; add the inline Add Session / Add Subtopic composers; `insertSection` gains a variant that inserts a custom heading with a stored `sessionTitle` and conditional `solutionPlaceholderNodes()`; insert position for sections resolves to the end of the current subtopic.
- Subtopic resolution: a helper walks headings above the insertion point to find the nearest subtopic heading; `collectLessonContext` starts scanning from that heading instead of the document start, and the payload's `subtopic` uses it.
- `src/components/lessonnotes/extensions/SectionHeading.tsx`: recognise subtopic headings (no AI toolbar — structural only) and custom-session headings (full AI toolbar, using the stored title as instruction).
- No schema changes, no edge-function changes: session title and solution flag ride on existing heading attributes and the existing `teacherPrompt` / `subtopic` payload fields.
