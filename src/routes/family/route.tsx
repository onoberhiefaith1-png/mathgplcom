import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireRole from "@/components/auth/RequireRole";

/** The Parent Console belongs to parent accounts only. */
export const Route = createFileRoute("/family")({
  component: () => (
    <RequireRole roles={["parent"]}>
      <Outlet />
    </RequireRole>
  ),
});
