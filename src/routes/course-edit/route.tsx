import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** Course Edit Suite is teacher-authoring: signed in only. */
export const Route = createFileRoute("/course-edit")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
