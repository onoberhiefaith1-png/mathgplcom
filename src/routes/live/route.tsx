import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** One platform sign-in covers every page under /live. */
export const Route = createFileRoute("/live")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
