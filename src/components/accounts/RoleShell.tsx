import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Eye } from "lucide-react";
import { useAccount } from "@/lib/accounts/useAccount";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { ROLE_LABEL, navFor } from "@/lib/accounts/roles";
import WorkspaceSwitcher from "@/components/accounts/WorkspaceSwitcher";

/**
 * Shared chrome for the role dashboards. The menu is built from the role *and*
 * the active workspace, so a teacher inside a school never sees school
 * administration, and a visited workspace is clearly marked view only.
 */
const RoleShell = ({ title, children }: { title: string; children: ReactNode }) => {
  const { role } = useAccount();
  const { kind, viewOnly, active } = useWorkspace();
  const nav = navFor(role, kind);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">{title}</h1>
        <div className="flex w-auto items-center justify-end gap-2">
          <WorkspaceSwitcher compact />
          <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {role ? ROLE_LABEL[role] : ""}
          </span>
        </div>
      </header>

      {viewOnly && (
        <div className="mx-auto mb-4 flex w-full max-w-6xl items-center gap-2 rounded-xl border border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          View only — you are visiting {active?.name ?? "this workspace"}. Nothing here can be edited.
        </div>
      )}

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
