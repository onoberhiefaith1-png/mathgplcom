## Plan: rebuild class SmartBoard teacher-to-student sync

### Goal
When a teacher opens a SmartBoard from a class, every approved student who opens that class SmartBoard should immediately see the same board and continue receiving live updates. No blank blue screen, no waiting message once the teacher has opened it.

### What I will change
1. **Replace the student SmartBoard loader with a simpler flow**
   - Authenticate the student.
   - Confirm they are either the class owner or a class member.
   - Read one source of truth: the class SmartBoard state row.
   - If that row has an active notebook, render `PresentationView` directly.
   - Keep listening for class board changes and update the active notebook live.

2. **Make teacher launch always create/open the class board state**
   - When the teacher opens `/smartboard/:notebookId?classId=...`, upsert the class SmartBoard state row.
   - Set student access on for that class.
   - Share the linked lesson note row for student reading.
   - Add a safe fallback insert/update for the class note link if it does not already exist.

3. **Rebuild the sync hook to be resilient**
   - Use the class board row as the single live channel.
   - Load current state first, then subscribe.
   - On realtime reconnect, reload from the database so students do not stay blank after a missed event.
   - Keep teacher writes debounced, but make the first teacher snapshot push reliably.

4. **Remove the fragile duplicate visibility subscriptions**
   - Student side should not depend on multiple independent realtime subscriptions fighting each other.
   - One reload function will refresh class visibility and active notebook together.

5. **Validate manually in browser**
   - Open the teacher SmartBoard route.
   - Open the student class SmartBoard route.
   - Confirm the student route renders the same notebook instead of the blank/waiting screen.
   - Confirm teacher board changes are applied on the student side after refresh/realtime load.

### Files to update
- `src/pages/SmartBoardPage.tsx`
- `src/pages/student/StudentSmartBoardPage.tsx`
- `src/hooks/useSmartboardSync.ts`
- Possibly `src/pages/class/ClassSmartBoardLauncher.tsx` only if the launch link needs cleanup

### Technical notes
- I will not change unrelated SmartBoard UI layout or assessment/game boards.
- I will not delete database tables or columns.
- If database permissions are still blocking student reads after the frontend rebuild, I will add only an additive backend migration for the class SmartBoard policies/publication.