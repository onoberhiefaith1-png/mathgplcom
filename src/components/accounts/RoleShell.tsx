import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";
import { useAccount } from "@/lib/accounts/useAccount";
import { ROLE_LABEL, ROLE_NAV } from "@/lib/accounts/roles";

/**
 * Shared chrome for the role dashboards. The menu is built from ROLE_NAV, so
 * each account type only ever sees its own navigation.
 */
const RoleShell = ({ title, children }: { title: string; children: ReactNode }) => {
  const { role } = useAccount();
  const nav = role ? ROLE_NAV[role] : [];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">{title}</h1>
        <span className="w-32 text-right text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {role ? ROLE_LABEL[role] : ""}
        </span>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <nav className="mb-8 flex flex-wrap gap-2">
          {nav.map((item) => (
            <Link
              key={item.to + item.label}
              to={item.to}
              className="rounded-full border border-border bg-card/40 px-4 py-1.5 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {children}
      </main>
    </div>
  );
};

export default RoleShell;
