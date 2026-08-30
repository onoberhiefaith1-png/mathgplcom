/**
 * The Personal Dashboard shell — the ownership layer.
 *
 * This is deliberately NOT the Community shell. Personal Dashboard answers
 * "what belongs to me?", so it carries no discovery navigation at all: no
 * Teachers/Schools/Students/Parents, no global Community search. Everything
 * here is the owner's own material. Discovery lives behind one outbound door.
 */
import { type ReactNode, useState } from "react";
import { Link } from "@/lib/router-compat";
import {
  BookOpen,
  Compass,
  Home,
  LayoutDashboard,
  Menu,
  Radio,
  Share2,
  Sparkles,
  SquarePen,
  Users,
  X,
} from "lucide-react";
import { useCommunityIdentity } from "@/lib/community/useCommunity";

/** My space: profile and presence. */
const MINE = [
  { to: "/community/dashboard", label: "My Dashboard", Icon: LayoutDashboard },
  { to: "/account/community-profile", label: "My Profile", Icon: SquarePen },
];

/** My content: created in MathGPL, owned here. */
const MY_CONTENT = [
  { to: "/lesson-notes", label: "My Lesson Notes", Icon: BookOpen },
  { to: "/course-builder", label: "My Courses", Icon: BookOpen },
  { to: "/adventure", label: "My Adventures", Icon: Sparkles },
  { to: "/class", label: "My Classes", Icon: Users },
  { to: "/live", label: "My MathGPL Live", Icon: Radio },
];

const NavGroup = ({
  heading,
  items,
  active,
  onNavigate,
}: {
  heading: string;
  items: { to: string; label: string; Icon: typeof Compass }[];
  active?: string;
  onNavigate?: () => void;
}) => (
  <div>
    <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-dash-surface/45">{heading}</p>
    <div className="space-y-1">
      {items.map(({ to, label, Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className={`flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-sm transition ${
            active === to
              ? "bg-dash-gold/15 font-semibold text-dash-gold"
              : "text-dash-surface/75 hover:white/5 hover:text-dash-surface"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </Link>
      ))}
    </div>
  </div>
);

const NavList = ({ active, onNavigate }: { active?: string; onNavigate?: () => void }) => (
  <nav className="space-y-6">
    <NavGroup heading="My space" items={MINE} active={active} onNavigate={onNavigate} />
    <NavGroup heading="My content" items={MY_CONTENT} active={active} onNavigate={onNavigate} />
  </nav>
);

const PersonalDashboardShell = ({
  children,
  active,
  title,
  subtitle,
}: {
  children: ReactNode;
  active?: string;
  title: string;
  subtitle?: string;
}) => {
  const { username } = useCommunityIdentity();
  const [drawer, setDrawer] = useState(false);

  return (
    /* Light, warm and owned — the visual opposite of the dark discovery space. */
    <div className="min-h-screen w-full bg-[linear-gradient(170deg,hsl(150_28%_9%),hsl(158_24%_14%))] text-dash-surface">
      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-white/10 px-4 py-6 lg:flex">
          <div className="px-2">
            <span className="rounded-full border border-white/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-100">
              My Dashboard
            </span>
            <p className="mt-2 px-1 text-[11px] uppercase tracking-[0.16em] text-dash-surface/45">My space · owned</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NavList active={active} />
          </div>
          <div className="space-y-2">
            <Link
              to="/community/network"
              className="flex min-h-[42px] items-center gap-3 rounded-xl border border-dash-gold/40 px-3 text-sm font-semibold text-dash-gold transition hover:bg-white/5"
            >
              <Compass className="h-4 w-4" /> Go to Community
            </Link>
            <Link
              to="/"
              className="flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-sm text-dash-surface/70 transition hover:bg-white/5"
            >
              <Home className="h-4 w-4" /> MathGPL workspace
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-white/10 px-4 py-6 sm:px-6">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-dash-surface lg:hidden"
                aria-label="Open dashboard navigation"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-dash-surface/50">
                  <Share2 className="h-3.5 w-3.5" /> My space
                </p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                {subtitle && <p className="mt-1 max-w-2xl text-sm text-dash-surface/70">{subtitle}</p>}
                {username && <p className="mt-1 text-xs text-dash-surface/50">@{username}</p>}
              </div>
            </div>
          </header>

          <main className="px-4 pb-24 pt-6 sm:px-6">{children}</main>
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close dashboard navigation"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-white/10 bg-[hsl(150_28%_10%)] px-4 py-6">
            <div className="flex items-center justify-between pb-4">
              <span className="text-sm font-semibold">My Dashboard</span>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavList active={active} onNavigate={() => setDrawer(false)} />
            <Link
              to="/community/network"
              onClick={() => setDrawer(false)}
              className="mt-6 flex min-h-[42px] items-center gap-3 rounded-xl border border-dash-gold/40 px-3 text-sm font-semibold"
            >
              <Compass className="h-4 w-4" /> Go to Community
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalDashboardShell;
