import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate, useLocation } from "@/lib/router-compat";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * The single platform guard. It waits for the stored session to resolve before
 * deciding anything, so a signed-in user is never asked to log in again, and it
 * remembers the exact destination when a visitor does need to sign in.
 */
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!ready || user) return;
    const dest = `${location.pathname}${location.search ?? ""}`;
    navigate(`/auth?next=${encodeURIComponent(dest)}`, { replace: true });
  }, [ready, user, navigate, location.pathname, location.search]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireAuth;
