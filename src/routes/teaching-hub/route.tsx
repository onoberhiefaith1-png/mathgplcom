import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** One platform sign-in covers every page under /teaching-hub. */
export const Route = createFileRoute("/teaching-hub")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
