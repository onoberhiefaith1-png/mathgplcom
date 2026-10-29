# Academia Tiered Evaluation — Design Footprint

**Status:** Design plan (Faith, call notes). Research / documentation only — no code changes in this pass.  
**Repo context:** MathGPL / LevelUp (`mathgplcom-fix` local copy).  
**Related research:** existing Academia hierarchy, session model, and activity assignment flows (lesson-note Assign → Academia, adventures, MCQ).

---

## 1. Product intent

Academia converts textbook material into **practice material**. It does **not** replace teaching.

Teachers (and the school shell) structure content so learners can practise what was taught: sessions with video context and ordered activities (questions, games, adventures, MCQ, etc.). Evaluation measures practice progress within that structure — not a substitute for classroom instruction.

---

## 2. Content hierarchy

```
academia
  └── class
        └── subject
              └── topic
                    └── subtopic
                          └── session
                                └── activities
```

- **Session** is the last menu level and the unit of practice/evaluation for this plan.
- **Activities** hang under a session (`academia_activities.session_id`).
- School owners build the outer shell (academia, classes, subjects, staffing). Subject teachers build topics → subtopics → sessions → activities (subject to `academia_can_build_subject` / subject-teacher list).

---

## 3. Three tiers per session

Each session has **three difficulty tiers**:

| Tier           | Expectation                                      |
|----------------|--------------------------------------------------|
| **Beginner**   | ≥ 10 questions                                   |
| **Intermediate** | ≥ 10 questions                                 |
| **Expert**     | ≥ 10 questions                                   |

Tiers are batches of practice within the same session, not separate sessions in the hierarchy.

---

## 4. Seamless progression and resume

- Learners move through tiers **seamlessly** (no hard “you must unlock” friction beyond the product’s designed ladder — progression feels continuous).
- **Resume where stopped:** returning to a session continues at the learner’s last place (tier / activity position), not from scratch unless they explicitly restart/cancel (see §7).

(Existing carousel position tracking via `academia_session_positions` is the natural hook for resume behaviour.)

---

## 5. Separate evaluation per tier

- Each tier has its **own evaluation** (score / status).
- Tiers the learner has **not** touched show **"not started yet"** — they do not inherit scores from other tiers and are not treated as attempted.

---

## 6. Current evaluation formula (baseline)

**Current evaluation** = score over the **total marks of attempted sessions** (only sessions the learner has actually attempted contribute to that denominator).

This plan extends that idea with per-tier separation and clearer class/subject scoping (§10–§11), without replacing the “attempted work only” principle for the primary score.

---

## 7. Cancel feature

**Purpose:** Let a learner (or teacher) wipe a bad / practice attempt so it no longer pollutes totals — without allowing grade forgery.

### Behaviour

- **Cancel** wipes the attempt and **removes it from the total** (as if that attempt never counted).
- **Self-practice only for students:** a student may cancel attempts on sessions they practise on their own.
- **Teacher-assigned sessions cannot be cancelled by the student.** If the session (or its activities) was assigned by a teacher into a normal class / formal path, the student has no cancel control.
- **Cannot forge grades:** cancel does not invent a better score; it removes the attempt from evaluation. No silent rewrite of marks into a chosen grade.
- **Logged for teachers:** every cancel is recorded so teachers can see that an attempt was cancelled (who, when, which session/tier).
- **Teachers can also cancel** (e.g. to clear a mistaken or invalid attempt).
- **One cancel per session** (cap): a given session allows at most one cancel (prevents repeated wipe/retry abuse). Exact scope of “one” (per learner per session lifetime vs per tier) should be locked in implementation; product intent from the call is **one cancel per session**.

---

## 8. Existing assign flows (current codebase)

These are today’s creation paths; tier selection (§9) will layer onto them.

| Kind / path | How it works today |
|-------------|--------------------|
| **`question`** | Lesson-note **Assign** → Academia picker: **Class → Subject → Topic → Subtopic → Session ± Game**. `assignToAcademia` creates/uses a hidden `workspace='academia'` class, runs the normal assessment assigner, then inserts/updates `academia_activities` (`kind: 'question'`). |
| **`adventure`** | Session page **Add Adventure** → `addSessionAdventure`. Questions onto learning points via `assignToLearningPoint` (`adventureSlots.ts`). |
| **`mcq`** | Papers at subject MCQ UI → session **Add Multiple Choice** → `assignPaperToSession` (copies into `academia_mcq_items`). |
| **`game` / `lesson_note` / `smartboard`** | Schema/kinds can **render** via `activityRoute()`, but **no UI currently creates** those activity rows. Session lesson notes attach as `academia_sessions.lesson_note_id` instead. |

**Also today:**

- Session **Assign** → `assignSessionToOwnClass` copies **question** activities (and games) into a teacher’s own normal class; adventures/MCQ not copied.
- No direct student-level Academia activity assignment; learners enter via session visibility / enrolment and `academia_enter_activity` (hidden class membership).

---

## 9. Tier chosen at assignment time

- When assigning practice into Academia, the **tier is chosen at assignment time**.
- Applies in **both**:
  1. Lesson-note Assign → Academia picker, and  
  2. MCQ add / `assignPaperToSession` flow.
- After assignment, **swap only within the same tier’s batch** — never cross-tier (a beginner question set cannot be swapped into intermediate/expert, and vice versa).

Implementation will need a tier field (or equivalent grouping) on activities or on assignment metadata so batches stay within beginner / intermediate / expert.

---

## 10. Evaluation scoped per class / subject

Evaluation is **scoped to a class + subject pair** (e.g. **Year One Mathematics**).

- Totals and progress for Year One Maths are **never combined** with another pair (e.g. Year Two Maths, or Year One English).
- Hierarchy already carries class → subject; evaluation aggregations must respect that boundary.

---

## 11. Progress presentation

- **Primary:** progress as **attempted-over-attempted** (how the learner is doing on work they have actually started) — aligned with §6’s “attempted sessions / marks” spirit, extended per tier.
- **Context:** also show standing against the **full class–subject total** (e.g. **50 of 300** marks available in that class/subject).
- **Tier ladder:** UI shows the journey across beginner → intermediate → expert (including “not started yet” for untouched tiers — §5).

---

## 12. Key files (implementation anchors)

| Area | Path |
|------|------|
| Core Academia API | `src/lib/academia/api.ts` |
| MCQ assign to session | `src/lib/academia/mcq/api.ts` |
| Adventure learning-point assign | `src/lib/academia/adventureSlots.ts` |
| Session page (video + activity carousel, Add Adventure / MCQ, Assign) | `src/pages/academia/AcademiaSessionPage.tsx` |
| Teacher Academia shell | `src/pages/academia/TeacherAcademiaPage.tsx` |
| School Academia shell | `src/pages/academia/SchoolAcademiaPage.tsx` |
| Lesson-note Assign dialog | `src/components/lessonnotes/AssignDialog.tsx` |
| Academia assign picker | `src/components/lessonnotes/AcademiaAssignPicker.tsx` (or under academia components — confirm path at implement time) |
| Session route | `src/routes/academia/session/$sessionId.tsx` |
| Schema | `supabase/migrations/` — `academia_*` tables (`academia_sessions`, `academia_activities`, `academia_attempts`, `academia_session_positions`, MCQ/adventure extras, RPCs such as `academia_enter_activity`, `academia_can_build_subject`, …) |

Supporting pages/routes already in play: activity / MCQ / practice / adventure Academia routes; offline pack/evaluation if desktop Mathemagine must mirror cancel and per-tier status later.

---

## Out of scope for this document

- Concrete schema migrations for `tier`, cancel audit log, and “one cancel per session” enforcement.
- Exact UI mockups for the tier ladder and cancel confirmation.
- Whether guest-linked sessions allow student cancel (default assumption: treat as constrained like teacher-assigned unless product says otherwise).

---

## Summary checklist (from call)

1. Academia = textbook → practice; does not replace teaching.  
2. Hierarchy: academia → class → subject → topic → subtopic → session → activities.  
3. Three tiers per session: beginner, intermediate, expert; 10+ questions each.  
4. Seamless tier progression; resume where stopped.  
5. Separate evaluation per tier; untouched = “not started yet”.  
6. Current eval = score over attempted sessions’ total marks.  
7. Cancel: wipe attempt, remove from total; self-practice only for students; teacher-assigned not student-cancellable; no grade forging; logged; teachers can cancel; one cancel per session.  
8. Existing assign flows documented (lesson-note picker, adventure, MCQ; game/note/smartboard kinds without create UI).  
9. Tier chosen at assignment (lesson-note + MCQ); swap only within tier batch.  
10. Evaluation scoped per class/subject; never combined across pairs.  
11. Progress = attempted-over-attempted primary; class–subject total as context; tier ladder for journey.  
12. Key files listed above.

---

*Captured for Faith from the planning call. Next step when ready: schema + API design for tier field, cancel audit, and evaluation aggregations — still gated on explicit implementation ask.*
