import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireRole from "@/components/auth/RequireRole";

/** The Teaching Hub belongs to teacher accounts only. */
export const Route = createFileRoute("/teaching-hub")({
  component: () => (
    <RequireRole roles={["teacher"]}>
      <Outlet />
    </RequireRole>
  ),
});
