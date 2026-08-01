import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";

/** MathGPL Community is available to every signed-in account. */
export const Route = createFileRoute("/community")({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
