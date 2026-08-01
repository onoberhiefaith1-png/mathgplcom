import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";
import { CommunityModeProvider } from "@/lib/community/mode";

/** MathGPL Community is available to every signed-in account, read-only. */
export const Route = createFileRoute("/community")({
  component: () => (
    <RequireAuth>
      <CommunityModeProvider>
        <Outlet />
      </CommunityModeProvider>
    </RequireAuth>
  ),
});
