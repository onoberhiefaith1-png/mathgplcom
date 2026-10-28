# Assigning several questions to the same class + game

## What is actually wrong

Your Game currently holds questions in **two different places**:

- `x + 7 = 12` — filed under **no class** (the Game's old shared pool)
- `2(x + 3) - 4x = 8` — filed under the class **Year5**
- `3x - 5 = 10` and `7m - 12 = 3m + 8` — filed under the class **camk**

Play only ever reads one of those lists. So when the newer question arrived
under a class, the older one stopped appearing — it was never deleted, just
left behind in the other list. That is the "it removed my first question"
effect.

Two further faults make it worse:

1. When you send a question to a class that **already has this Game**, the
   assign screen skips the step that files the question — so the question can
   appear to do nothing at all.
2. The assign screen checks "is this question already in the Game?" against the
   shared pool instead of the class you are assigning to, so it reports the
   wrong state.
3. The hidden per-class play records have piled up (13 copies of one question,
   50 of another), because the lookup that should find the existing one fails
   when duplicates exist and then creates another.

## What will happen after this

- Sending a question to a class + game **always adds a level**. Q1 stays Level 1,
  Q2 becomes Level 2, Q3 becomes Level 3 — nothing is ever replaced.
- The assign screen lists the levels already in the chosen class + game, and
  shows the new question as the level it will become.
- `x + 7 = 12` moves into a class of your choosing as a level, so it stops
  living outside every class. The one-off move offers Year5 and camk; you pick.
- Removing a class from the Game keeps that class's questions and their order,
  ready if you give the Game back.
- Level numbering is always tidy (1, 2, 3…) even after removals — camk currently
  starts at 2 because of an earlier removal; that is repaired.
- Deleting a question from a class stays available and affects only that class.

## Steps

1. **Assign always adds.** In the assign screen, file the question into every
   ticked class's collection, not only classes newly ticked, and test "already
   present" against that class instead of the shared pool. Appending keeps the
   existing levels untouched.
2. **Show the levels.** Under the Game picker, list the chosen class's current
   levels and the position the new question will take, so the outcome is visible
   before you press Assign.
3. **Move the homeless question.** Offer a one-time "Move into class" action for
   any question sitting outside every class, in the Questions list where those
   are already shown. Choosing a class appends it as that class's next level and
   removes it from the shared pool.
4. **Tidy level numbers.** Renumber a class's questions 0…n-1 whenever one is
   added, moved or removed.
5. **Repair the duplicate play records.** Keep the oldest hidden record per
   class + question, delete the surplus, and make the builder tolerant of
   duplicates so it reuses rather than adds. This is why a level sometimes
   opened stale content.
6. **Verify.** Assign a second and third question to one class, confirm three
   levels in the class list, the journey map and Play; confirm the other class is
   untouched; confirm the moved question appears as a level; confirm marking,
   rewards, Vault, timers and sounds are unchanged.

## Technical notes

- `src/components/lessonnotes/AssignDialog.tsx`: join inside the loop over all
  selected classes (currently only `toAssign`); per-class `listGameQuestions(gameId, classId)`
  for the presence check; render the class's level list.
- `src/lib/slate/gameQuestions.ts`: `assignQuestion` computes the next position
  per class scope; add `moveQuestionToClass(id, classId)` and a `normalisePositions(gameId, classId)`
  used after add/remove/reorder.
- `src/lib/slate/gameBoard.ts`: replace `maybeSingle()` on the hidden
  `kind='game'` assessment lookup with an ordered `limit(1)`, so duplicates can
  never cause a fresh insert.
- Migration: delete surplus `assessments` rows where `kind='game'` keeping the
  oldest per `(class_id, question_key)`; add a unique index on that pair for
  `kind='game'` so duplicates cannot return.
- Unchanged: Slate Artisan, Floating Numbers, grading, predictive evaluation,
  rewards, Vault rules, sounds, rooms, camera, saved stage design.
