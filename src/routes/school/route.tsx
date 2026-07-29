import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** One platform sign-in covers every page under /school. */
export const Route = createFileRoute("/school")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
