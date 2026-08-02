import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** Skill Builder is teacher-authoring: signed in only. */
export const Route = createFileRoute("/course-builder")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
