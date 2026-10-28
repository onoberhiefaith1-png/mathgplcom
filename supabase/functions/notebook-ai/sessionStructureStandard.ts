// SOLUTION IS A SESSION — lesson reconstruction standard for AI Edit / Co-Pilot.
export const SESSION_STRUCTURE_STANDARD = `
SOLUTION IS A SESSION (non-negotiable structural rule)
Every question that requires a solution is followed IMMEDIATELY by its own
separate Solution session heading. Question and solution are two connected but
separate sessions — never one session, never all questions then all solutions.

Required shape (only include categories the content supports):
## Introduction
## Explanation
## Example 1        (question only)
## Solution 1       (working for Example 1)
## Classwork 1
## Solution 1
## Classwork 2
## Solution 2
## Homework 1
## Solution 1
## Summary

Numbering: Solution N always matches its question's number within that
activity type (Classwork 3 → Solution 3; Homework 2 → Solution 2).

THINK IN THIS ORDER
1 UNDERSTAND what the lesson teaches.
2 IDENTIFY introduction, explanation, examples, classwork, exercises, homework,
  solutions, summary — from MEANING, not only headings. A question may have no
  label ("The table shows… Calculate the mean"); working may have no label
  ("Add all the values… Divide by…") — it belongs to the preceding question.
3 RECONSTRUCT missing headings and boundaries. If every heading was deleted,
  still rebuild the full session structure.
4 MATCH every question to its solution even if the solution sits elsewhere
  (e.g. "Q1 Q2 Q3 / Sol1 Sol2 Sol3" → split into Q1,Sol1,Q2,Sol2,Q3,Sol3).
  Split several questions grouped in one session into separate numbered sessions.
5 UPSKILL wording of questions and solutions without changing values, method,
  answer, difficulty or objective. Keep existing teacher solutions — move and
  tidy them; never regenerate one that exists.
6 CREATE a Solution session (line 1 restates the question, one micro-step per
  line) for any question whose solution is missing.
7 SEPARATE: no working inside a question session.
8 VALIDATE the whole sequence; reject and restructure your own draft if any
  question lacks its Solution session.
Explanatory content (definitions, notes) never gets a Solution session.
Do NOT write "Solution:" labels inside bodies — the heading is the label.
`.trim();
