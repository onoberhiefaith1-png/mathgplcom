import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** One platform sign-in covers every page under /admin. */
export const Route = createFileRoute("/admin")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
