import { useEffect, type ReactNode } from "react";
import { Loader2, LogIn } from "lucide-react";
import { useNavigate, useLocation } from "@/lib/router-compat";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";

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
    // Never bounce off the sign-in pages themselves — that loops the `next` param.
    if (/^\/(login|signup|auth)(\/|$)/.test(location.pathname)) return;
    const dest = `${location.pathname}${location.search ?? ""}`;
    navigate(`/login?next=${encodeURIComponent(dest)}`, { replace: true });
  }, [ready, user, navigate, location.pathname, location.search]);


  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <div className="flex items-center"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Restoring your session…</div>
        <Button
          variant="outline"
          onClick={() => navigate(`/login?next=${encodeURIComponent(location.pathname + (location.search ?? ""))}`)}
        >
          <LogIn className="mr-2 h-4 w-4" /> Go to login
        </Button>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
};

export default RequireAuth;
