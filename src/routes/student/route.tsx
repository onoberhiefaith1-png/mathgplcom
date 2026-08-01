import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";
import StudentShell from "@/components/student/StudentShell";

/**
 * One platform sign-in covers every page under /student, and one responsive
 * shell gives every page the right navigation for the device in use.
 */
export const Route = createFileRoute("/student")({
  component: () => (
    <RequireAuth>
      <StudentShell>
        <Outlet />
      </StudentShell>
    </RequireAuth>
  ),
});
