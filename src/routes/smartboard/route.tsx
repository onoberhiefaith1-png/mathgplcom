import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** One platform sign-in covers every page under /smartboard. */
export const Route = createFileRoute("/smartboard")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
