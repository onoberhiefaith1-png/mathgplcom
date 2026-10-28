import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireRole from "@/components/auth/RequireRole";
import StudentShell from "@/components/student/StudentShell";

/**
 * The Student Workspace belongs to student accounts only, and one responsive
 * shell gives every page the right navigation for the device in use.
 */
export const Route = createFileRoute("/student")({
  component: () => (
    <RequireRole roles={["student"]}>
      <StudentShell>
        <Outlet />
      </StudentShell>
    </RequireRole>
  ),
});
