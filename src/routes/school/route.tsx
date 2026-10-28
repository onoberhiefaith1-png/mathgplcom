import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireRole from "@/components/auth/RequireRole";

/** The School Console belongs to school accounts only. */
export const Route = createFileRoute("/school")({
  component: () => (
    <RequireRole roles={["school"]}>
      <Outlet />
    </RequireRole>
  ),
});
