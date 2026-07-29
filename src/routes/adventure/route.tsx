import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** One platform sign-in covers every page under /adventure. */
export const Route = createFileRoute("/adventure")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
