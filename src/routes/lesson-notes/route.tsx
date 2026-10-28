import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** One platform sign-in covers every page under /lesson-notes. */
export const Route = createFileRoute("/lesson-notes")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
