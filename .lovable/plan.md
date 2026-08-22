# Student navigation + workspace-scoped Join Class

Three corrections to the student experience: navigation buttons in the workspace shell, Join Class moved out of the personal dashboard into a school/teacher workspace, and a code/link join that actually lets the student in.

## 1. Back / Forward navigation

The workspace shell header (used by every student, teacher, school and parent page) gains Back and Forward buttons at the top left, next to the page title. Back uses the app's own navigation stack (the existing `BackButton` behaviour), Forward steps ahead in browser history. Both are disabled-looking when there is nowhere to go, and are 44px touch targets on phones.

## 2. Join Class leaves the personal student dashboard

A student cannot join a class from their own identity — a class always lives inside a teacher's or a school's workspace.

- Remove the Join Class card from `/student` (Student Dashboard), the Join Class item from the student left-nav, and the Join Class section from My Classes.
- `/student/join` no longer exists as a personal page; the invite routes `/join` and `/join/:code` stay (a link from a teacher must still work).
- Inside a workspace (`/student/schools/:orgId/dashboard`, `/student/teachers/:ownerId/dashboard`) Join Class becomes a real panel: the join-code field, the invite-link field and the student's MathGPL ID, scoped to that owner.
- The dashboard keeps guidance: "Open a school or a teacher first, then join a class inside it."

## 3. Entering a class with a code or invite link must work

Current behaviour, confirmed in the code and database: the join check (`class_join_gate`) only says "allowed" when the student is already a member of the class's school organisation. A teacher's class inside a school therefore refuses a connected student who has entered that teacher's workspace — the "private workspace, ask your school" message in the screenshot. Even when allowed, the panel only files a request and waits for teacher approval, so nothing opens.

New rule, enforced in the database:

```text
code / invite link
  -> is this student inside the owner's workspace?  (connected + entered)
        yes -> enrolled immediately, opens /student/class/:id
        no  -> "Enter this teacher/school first" with a link to that entrance
  -> class belongs to a school the student belongs to -> enrolled immediately
  -> otherwise -> request sent to the teacher (existing behaviour)
```

Entering a workspace stays the gate that guards paid access, so this does not open any content a student had not already been granted.

## Technical notes

- `WorkspaceLayout` header: add Back (`useNavHistory().goBack`) and Forward (`navigate(1)`) controls; extend `NavHistory` with `goForward`/`canGoForward` tracked from the stack.
- Additive migration:
  - Redefine `public.class_join_gate(code)` so `allowed` is also true when a row in `student_workspace_access` matches the class's `owner_id`, or its `org_id`.
  - New `public.join_class_with_code(code text)` — `SECURITY DEFINER`, returns the class id or a status string. It re-checks the same gate for `auth.uid()` and inserts into `class_members` (`ON CONFLICT DO NOTHING`) only when entry is allowed; `class_members` INSERT stays owner-only for direct writes. Grant `EXECUTE` to `authenticated`.
- `JoinClassPanel` gains an owner-scoped mode (`ownerId` / `orgId` props): calls `join_class_with_code`, navigates to `/student/class/:id` on success, falls back to the existing join-request path when the class sits outside the student's entered workspaces, and shows an "Enter this workspace" link when that is the blocker.
- `WorkspaceHomePage` renders that panel in place of its current link to `/student/join`; `StudentDashboard`, `workspaceNav.ts` and `roles.ts` drop the Join Class entry; `src/routes/student/join/index.tsx` and `StudentJoinClassPage.tsx` are removed.
- No changes to teacher, school or Community surfaces beyond the shared header buttons.
