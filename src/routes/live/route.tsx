import { createFileRoute, Outlet } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";
import { useLocation } from "@/lib/router-compat";

/**
 * MathGPL Live has two audiences.
 *
 * Teachers (hub, sessions, workspace, lesson notes, gallery, reports) sign in
 * once for the whole platform. Audience members arrive through a share link —
 * they never register, so /live/join and /live/s/:id must stay open. The gate
 * therefore applies per path instead of to the whole subtree.
 */
const AUDIENCE_PATHS = [/^\/live\/join(\/|$)/, /^\/live\/s\//];

const LiveGate = () => {
  const location = useLocation();
  const audience = AUDIENCE_PATHS.some((re) => re.test(location.pathname ?? ""));

  if (audience) return <Outlet />;

  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
};

export const Route = createFileRoute("/live")({
  component: LiveGate,
});
