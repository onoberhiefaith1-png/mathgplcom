import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { ChevronDown, LogOut, LayoutDashboard, Users } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

import { useAccount } from "@/lib/accounts/useAccount";

type MenuLink = { to: string; label: string };

/**
 * One "Account" button in one place for everyone. What it opens depends on the
 * signed-in role:
 *
 *   Platform Owner → Schools / Teachers / Parents / Students (platform lists)
 *   School         → teacher management
 *   Parent         → connected teachers
 *   Teacher        → nothing at all (students live inside Classes)
 *   Student        → nothing at all
 */
const ROLE_LINKS: Record<string, MenuLink[]> = {
  platform_owner: [
    { to: "/admin?tab=schools", label: "Schools" },
    { to: "/admin?tab=teachers", label: "Teachers" },
    { to: "/admin?tab=parents", label: "Parents" },
    { to: "/admin?tab=students", label: "Students" },
  ],
  co_admin: [
    { to: "/admin?tab=schools", label: "Schools" },
    { to: "/admin?tab=teachers", label: "Teachers" },
  ],
  school: [{ to: "/school/teachers", label: "Teachers" }],
  parent: [{ to: "/family/teachers", label: "Teachers" }],
};

const AccountMenu = () => {
  const { user, ready } = useAuth();
  const { role, isLoading } = useAccount();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const signOut = async () => {
    setOpen(false);
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  // Teachers and students never see an Account button.
  const signedIn = ready && Boolean(user);
  if (signedIn && (isLoading || role === "teacher" || role === "student")) return null;

  const links = signedIn ? (ROLE_LINKS[role ?? ""] ?? []) : [];

  return (
    <div ref={ref} className="pointer-events-auto relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-background/55 px-4 py-2 text-sm font-medium text-primary shadow-[0_4px_22px_hsl(var(--background)/0.6)] backdrop-blur transition hover:border-primary hover:bg-background/80 sm:px-5 sm:text-base"
      >
        <span>Account</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-border/60 bg-background/95 p-1 shadow-[0_18px_60px_hsl(var(--background)/0.7)] backdrop-blur"
        >
          {signedIn ? (
            <>
              {links.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-primary/15"
                >
                  <Users className="h-4 w-4" /> {item.label}
                </Link>
              ))}
              <Link
                to="/home"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-primary/15"
              >
                <LayoutDashboard className="h-4 w-4" /> My dashboard
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-primary/15"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </>
          ) : (
            <>
              {/* One login for everyone — the account type is detected after sign-in. */}
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-foreground transition hover:bg-primary/15"
              >
                Login
              </Link>
              <Link
                to="/signup"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-foreground transition hover:bg-primary/15"
              >
                Create Account
              </Link>
            </>
          )}

        </div>
      )}
    </div>
  );
};

export default AccountMenu;
