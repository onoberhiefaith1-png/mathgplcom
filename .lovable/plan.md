## Student Edit Permission — completion plan

Good news: the core of this feature already exists and works. The remaining work is finishing the rules the spec adds. This is a **frontend-only** change — no database or sync-engine changes are needed.

### What already works today
- One student at a time can be granted edit rights from the teacher's board (the floating "people" control).
- Selecting a new student instantly revokes the previous one (Student A → view-only, Student B → editor).
- Teacher always retains edit rights; teacher + 1 student = max 2 editors.
- A view-only student currently sees the board but cannot type, draw, or touch any control (all controls are hidden).
- Edits by the active student sync live to the teacher and all viewers via the existing realtime system.

### Gaps to close (the actual work)

1. **On-screen status indicator (new)**
   On a student's board, show a small fixed banner at the top:
   - Green "Editing Enabled by Teacher" when that student is the active editor.
   - Neutral "View Only Mode" otherwise.
   This banner is always visible to students (it is intentionally exempt from the control-hiding logic).

2. **Restrict teacher-only controls from the active student (new)**
   Right now, when a student is granted edit rights, every control appears (because they can edit). The spec requires the student editor to get only board/writing/drawing/math tools, while teacher-exclusive controls stay hidden.

   - Keep ENABLED for the active student: bottom math-input panel, the three assistant buttons (numbers / structures / symbols), left rail undo-redo + drop-line / dot / box, the draggable eraser, ink-style rail, and the writing surface itself.
   - Keep HIDDEN for the active student: the top toolbar (Back to Shelf, Clear Board, Settings, zoom, lesson prev/next) and its pull-tab, the right-edge "Next section" lesson control, the AI verification toggle, and (already hidden) the student-permission control.

   Mechanism: tag teacher-exclusive chrome with a `data-sb-teacher-only` marker and inject a style rule that hides those elements whenever `role === "student"`, even when the student can edit. View-only students keep the existing "hide everything" rule.

3. **Relabel the control to match the spec (polish)**
   Rename the teacher's student-selection control from "Active Student" to "Student Can Edit", and update its helper copy ("Select one student to grant editing", "Teacher only — take back control"). It stays on the live board (the natural place for the teacher to hand off mid-lesson), grouped with the board-accessibility affordances.

### Files touched
- `src/components/smartboard/PresentationView.tsx` — add the student status banner; add `data-sb-teacher-only` markers to the top header, top pull-tab, right-edge next-section button, and AI verify toggle; add a `role === "student"` style block hiding teacher-only chrome.
- `src/components/smartboard/ActiveStudentControl.tsx` — relabel to "Student Can Edit" and refresh helper text.

### Technical notes
- No migration required: `class_smartboard_state.active_student_id`, the active-student write RLS policy, and realtime publication are already in place from the previous phase.
- `canEdit = isTeacher || isActiveStudent` stays the source of truth for input gating; we only add a second, narrower visibility layer (`data-sb-teacher-only`) so an editing student can use tools without seeing teacher controls.
- The status banner renders for `role === "student"` only and carries no `data-sb-chrome` marker so it survives the view-only hide rule.
