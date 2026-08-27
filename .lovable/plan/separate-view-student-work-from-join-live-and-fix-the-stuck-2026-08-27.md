# Separate View Student Work from Join Live (and fix the stuck live join)

Two different features, currently tangled: one reads saved work per question, the other joins the board the student already has open.

## Why Join Live gets stuck (verified in code)

An assignment card is a set of per-question assessment rows. The dashboard's online dot is correct: it merges presence from **every** assessment in the card (`AssignmentDashboardPage`, one presence channel per assessment id), so "In Progress" means "the student is on some question board of this card".

But both dashboard actions navigate to `firstAssessmentId` only. The viewer then subscribes to presence and live frames for **that** assessment id (`assessment-presence-<class>-<firstAssessment>`, `assessment-live-<firstAssessment>-<student>`). If the student is on question 2 or 3, the viewer's channels are the wrong ones: no presence record, no board frames, and live mode — which deliberately refuses to guess — parks on "Waiting for the student's board…" forever.

So the student's board is genuinely open; the teacher is simply listening on the wrong room.

## 1. Join Live joins the room the student is actually in

- The dashboard already knows, per assessment, which students are present. Keep that map and pass the **assessment the student is present on** into Join Live, so the teacher opens that student's live question board directly. When a student shows up on more than one, use the most recent presence record.
- Join Live stays enabled only for In Progress students (unchanged), and the status rules themselves are untouched.
- Viewer hardening so a stale link can never hang again: in live mode the viewer also watches presence and live frames across the card's other assessments, and when it finds the student, it switches itself to that assessment's board instead of waiting.
- The waiting screen becomes a brief transitional state only (no student signal anywhere in the card), with a one-click "View saved work instead". No new board session is created, nothing the student did is reset or reloaded on their side — the teacher only subscribes to the existing broadcast.
- Once joined, the board mirrors the student's live state as it already does (board frames plus the evaluation panel), and follows the student if they change question.

## 2. View Student Work becomes per question

- In the status panel, clicking a student row expands a per-question list for that student: question label, **View Student Work**, and the Best Time for that question beside it.
- View Student Work is present for every question, always enabled — never gated on the timer, on Best Time existing, or on the student being online. Available for Inactive, In Progress and Completed students alike.
- It opens the viewer in work mode on that exact question (`?mode=work&q=<question>`), reading the student's latest saved board state. Nothing saved yet, or reset before leaving, means the question renders in its initial/empty state — that is what the student left behind.
- The row-level "View Student Work" button remains as the shortcut to the last question the student saved.
- The Best Times board keeps working exactly as it does; the per-question best time is reused for the expanded list.

## Technical notes

- `src/pages/class/AssignmentDashboardPage.tsx`, `src/pages/class/AdventureDashboardPage.tsx` — keep the per-assessment presence map in state; `onJoinLive(studentId)` resolves the student's present assessment id; new `onViewQuestion(studentId, assessmentId, questionId)`.
- `src/components/dashboards/AssessmentStatusPanel.tsx` — expandable student row rendering the question list with per-question View Student Work + best time; needs question refs and best-time-per-question passed in from the dashboard (same query the timer panel already runs).
- `src/pages/class/TeacherAssessmentViewerPage.tsx` — accept the card's sibling assessment ids, subscribe to their presence/live channels in live mode, self-redirect to the assessment carrying the student, and reduce the waiting state to a short transitional screen with a work-mode escape hatch.
- `src/lib/assessments/viewerFollow.ts` — unchanged resolver contract (live stays student-driven only); tests extended for "live redirects to the assessment where the student is present".
