import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** One platform sign-in covers every page under /family. */
export const Route = createFileRoute("/family")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
