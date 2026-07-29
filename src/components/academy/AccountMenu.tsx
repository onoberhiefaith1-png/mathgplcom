import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { UserRound, ChevronDown, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { ACCOUNT_MENU } from "@/lib/accounts/authForms";

/**
 * Single "Account" entry point for the whole platform. Visitors pick their
 * account type; signed-in users get their dashboard and sign-out instead.
 */
const AccountMenu = () => {
  const { user, ready } = useAuth();
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

  const label = user ? (user.email?.split("@")[0] ?? "Account") : "Account";

  return (
    <div ref={ref} className="pointer-events-auto relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-background/55 px-4 py-2 text-sm font-medium text-primary shadow-[0_4px_22px_hsl(var(--background)/0.6)] backdrop-blur transition hover:border-primary hover:bg-background/80 sm:px-5 sm:text-base"
      >
        <UserRound className="h-4 w-4" />
        <span className="max-w-[9rem] truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-border/60 bg-background/95 p-1 shadow-[0_18px_60px_hsl(var(--background)/0.7)] backdrop-blur"
        >
          {ready && user ? (
            <>
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
              <p className="px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Choose your account
              </p>
              {ACCOUNT_MENU.map((item) => (
                <Link
                  key={item.key}
                  to={`/auth/${item.key}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-primary/15"
                >
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
