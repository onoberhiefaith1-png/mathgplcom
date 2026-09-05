import { useState, type ReactNode } from "react";
import { Bell, ChevronLeft, ChevronRight, Menu, Search, X } from "lucide-react";

import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import { useNavHistory } from "@/lib/nav/NavHistory";

import { useAccount } from "@/lib/accounts/useAccount";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { ROLE_LABEL } from "@/lib/accounts/roles";
import { useMathgplId } from "@/lib/accounts/useMathgplId";
import { useProfileSummary } from "@/lib/accounts/useProfileSummary";
import { useConnectionCounts } from "@/lib/connections/useConnections";
import WorkspaceSwitcher from "@/components/accounts/WorkspaceSwitcher";
import AccountAvatar from "@/components/accounts/AccountAvatar";
import WorkspaceGoLive from "./WorkspaceGoLive";
import { navGroupsFor } from "./workspaceNav";
import { useT } from "@/lib/i18n/LanguageProvider";
import LanguageSelector from "@/components/i18n/LanguageSelector";

/**
 * The one shell every account works inside: navigation on the left, the
 * workspace itself in the middle, and the context of that workspace on the
 * right. Roles change what the panels contain — never where they are.
 *
 * The chrome is deliberately the entrance to the building: a dark night canvas,
 * a gold crest and violet magic in the light. It is not a document surface, so
 * it never borrows the white paper of the lesson note.
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
  const { displayName } = useProfileSummary();
  const { counts } = useConnectionCounts();
  const location = useLocation();
  const { goBack, goForward } = useNavHistory();
  const t = useT();

  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [term, setTerm] = useState("");

  const shared = Boolean(active && !active.isOwner && active.kind === "school" && role === "teacher");
  const groups = navGroupsFor(role, kind, { shared });
  const path = location.pathname ?? "";

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const q = term.trim();
    if (!q) return;
    navigate(`/community/discover?q=${encodeURIComponent(q)}`);
    setNavOpen(false);
  };

  const nav = (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-5">
      <Link to="/" className="flex items-center gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ws-gold/40 bg-gradient-to-br from-ws-gold/25 to-ws-violet/20 text-sm font-black text-ws-gold shadow-[0_0_18px_-6px_hsl(var(--ws-gold)/0.7)]">
          M
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-wide text-foreground">MathGPL</span>
          <span className="block truncate text-[10px] uppercase tracking-[0.24em] text-ws-gold/80">
            {active && !active.isOwner ? `Shared workspace · ${active.name}` : "Personal workspace"}
          </span>
        </span>
      </Link>

      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-ws-border/70 bg-ws-panel/70 p-3">
        <span className="shrink-0 rounded-full ring-2 ring-ws-gold/40">
          <AccountAvatar size={40} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{displayName || "My account"}</div>
          <div className="truncate text-[10px] uppercase tracking-[0.18em] text-ws-violet">
            {role ? ROLE_LABEL[role] : "Account"}
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{mathgplId ?? "—"}</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-ws-gold/70">
              {t(group.titleKey)}
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
                          ? "border border-ws-gold/40 bg-gradient-to-r from-ws-gold/20 to-ws-violet/10 text-foreground"
                          : "border border-transparent text-muted-foreground hover:border-ws-border/70 hover:bg-ws-panel/70 hover:text-foreground"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${activeItem ? "text-ws-gold" : ""}`} />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <WorkspaceGoLive />
    </div>
  );

  return (
    <div
      className="min-h-screen w-full bg-ws-canvas text-foreground"
      style={{ backgroundImage: "var(--gradient-ws-canvas)" }}
    >
      <div className="flex w-full">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-ws-border/70 bg-ws-canvas/70 backdrop-blur lg:block">
          {nav}
        </aside>

        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-ws-canvas/80 backdrop-blur-sm"
              onClick={() => setNavOpen(false)}
            />
            <aside className="absolute left-0 top-0 h-full w-72 border-r border-ws-border bg-ws-canvas shadow-2xl">
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
          <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-ws-border/70 bg-ws-canvas/80 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation"
                onClick={() => setNavOpen(true)}
                className="rounded-md p-2 text-muted-foreground hover:text-foreground lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Back"
                  title="Back"
                  onClick={() => goBack("/")}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-ws-border/70 bg-ws-panel/60 text-muted-foreground transition hover:border-ws-gold/50 hover:text-foreground sm:h-11 sm:w-11"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Forward"
                  title="Forward"
                  onClick={goForward}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-ws-border/70 bg-ws-panel/60 text-muted-foreground transition hover:border-ws-gold/50 hover:text-foreground sm:h-11 sm:w-11"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>

            </div>
            <div className="flex shrink-0 items-center gap-2">
              <form onSubmit={search} className="hidden md:block">
                <label className="flex items-center gap-2 rounded-full border border-ws-border/70 bg-ws-panel/60 px-3 py-1.5">
                  <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <input
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Search the Community"
                    aria-label="Search the MathGPL Community"
                    className="w-40 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground xl:w-52"
                  />
                </label>
              </form>
              <WorkspaceSwitcher compact />
              <Link
                to="/requests"
                aria-label="Requests"
                title="Requests"
                className="relative rounded-md p-2 text-muted-foreground transition hover:bg-ws-panel hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                {counts.pendingIncoming > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-ws-gold px-1 text-[10px] font-bold text-ws-canvas">
                    {counts.pendingIncoming}
                  </span>
                )}
              </Link>
              <Link to="/account" aria-label="My account" className="rounded-full ring-2 ring-ws-gold/40">
                <AccountAvatar size={32} />
              </Link>
            </div>
          </header>

          {viewOnly && (
            <div className="border-b border-ws-gold/30 bg-ws-gold/10 px-4 py-2 text-xs text-ws-gold sm:px-6">
              View only — you are visiting {active?.name ?? "this workspace"}. Nothing here can be edited.
            </div>
          )}

          {shared && !viewOnly && (
            <div className="border-b border-ws-violet/30 bg-ws-violet/10 px-4 py-2 text-xs text-ws-violet sm:px-6">
              Shared Workspace — {active?.name ?? "this school"} · {displayName || "you"}. Your teaching here belongs to
              this school; your Personal Workspace stays separate. The Building belongs to the school.
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
