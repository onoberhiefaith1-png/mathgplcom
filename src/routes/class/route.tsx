import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** One platform sign-in covers every page under /class. */
export const Route = createFileRoute("/class")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
