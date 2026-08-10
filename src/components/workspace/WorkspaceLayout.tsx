import { useState, type ReactNode } from "react";
import { Bell, Menu, X } from "lucide-react";

import { Link, useLocation } from "@/lib/router-compat";
import { useAccount } from "@/lib/accounts/useAccount";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { ROLE_LABEL } from "@/lib/accounts/roles";
import { useMathgplId } from "@/lib/accounts/useMathgplId";
import { useConnectionCounts } from "@/lib/connections/useConnections";
import WorkspaceSwitcher from "@/components/accounts/WorkspaceSwitcher";
import AccountAvatar from "@/components/accounts/AccountAvatar";
import { navGroupsFor } from "./workspaceNav";

/**
 * The one shell every account works inside: navigation on the left, the
 * workspace itself in the middle, and the context of that workspace on the
 * right. Roles change what the panels contain — never where they are.
 */
const WorkspaceLayout = ({
  title,
  subtitle,
  rail,
  children,
}: {
  title: string;
  subtitle?: string;
  rail?: ReactNode;
  children: ReactNode;
}) => {
  const { role } = useAccount();
  const { kind, active, viewOnly } = useWorkspace();
  const { mathgplId } = useMathgplId();
  const { counts } = useConnectionCounts();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  const groups = navGroupsFor(role, kind);
  const path = location.pathname ?? "";

  const nav = (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-5">
      <Link to="/" className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-sm font-black text-primary">
          M
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">MathGPL</span>
          <span className="block truncate text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {active?.isOwner === false ? active.name : "Personal workspace"}
          </span>
        </span>
      </Link>

      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-card/50 p-3">
        <AccountAvatar size={40} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {role ? ROLE_LABEL[role] : "Account"}
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{mathgplId ?? "—"}</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {group.title}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const base = item.to.split("?")[0];
                const activeItem = base === "/" ? path === "/" : path === base;
                return (
                  <li key={item.to + item.label}>
                    <Link
                      to={item.to}
                      onClick={() => setNavOpen(false)}
                      className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                        activeItem
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <div className="flex w-full">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border/60 bg-card/30 backdrop-blur lg:block">
          {nav}
        </aside>

        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              onClick={() => setNavOpen(false)}
            />
            <aside className="absolute left-0 top-0 h-full w-72 border-r border-border bg-background shadow-2xl">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setNavOpen(false)}
                className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              {nav}
            </aside>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation"
                onClick={() => setNavOpen(true)}
                className="rounded-md p-2 text-muted-foreground hover:text-foreground lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <WorkspaceSwitcher compact />
              <Link
                to="/requests"
                aria-label="Requests"
                title="Requests"
                className="relative rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                {counts.pendingIncoming > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {counts.pendingIncoming}
                  </span>
                )}
              </Link>
              <Link to="/account" aria-label="My account" className="rounded-full">
                <AccountAvatar size={32} />
              </Link>
            </div>
          </header>

          {viewOnly && (
            <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200 sm:px-6">
              View only — you are visiting {active?.name ?? "this workspace"}. Nothing here can be edited.
            </div>
          )}

          <div className="mx-auto grid w-full max-w-[1500px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <main className="min-w-0 space-y-6">{children}</main>
            {rail && <aside className="min-w-0 space-y-4">{rail}</aside>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceLayout;
