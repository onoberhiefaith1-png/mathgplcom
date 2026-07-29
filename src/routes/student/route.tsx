import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** One platform sign-in covers every page under /student. */
export const Route = createFileRoute("/student")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
