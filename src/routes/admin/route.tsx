import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireRole from "@/components/auth/RequireRole";

/** Platform administration belongs to administrator accounts only. */
export const Route = createFileRoute("/admin")({
  component: () => (
    <RequireRole roles={["platform_owner", "co_admin"]}>
      <Outlet />
    </RequireRole>
  ),
});
