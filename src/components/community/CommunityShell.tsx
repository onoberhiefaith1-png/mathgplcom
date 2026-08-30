/**
 * The Community dashboard shell.
 *
 * Community is a separate public space, not a second workspace: it has its own
 * navigation, its own search and no Building editor. The rotating building
 * remains the entrance; everything discoverable lives behind this shell.
 */
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import {
  BookOpen,
  Compass,
  GraduationCap,
  Home,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Radio,
  School,
  Search,
  Sparkles,
  Users,
  UserRound,
  Users2,
  X,
} from "lucide-react";
import { useCommunityIdentity } from "@/lib/community/useCommunity";

/**
 * Community is discovery only. Owned content lives in the Personal Dashboard
 * shell, reachable through a single outbound door at the foot of this rail.
 */
const NETWORK = [
  { to: "/community/network", label: "Community", Icon: Compass },
  { to: "/community/feed", label: "Feed", Icon: MessageSquare },
  { to: "/community/live", label: "Live Now", Icon: Radio },
  { to: "/community/lesson-notes", label: "Lesson Notes", Icon: BookOpen },
  { to: "/community/courses", label: "Courses", Icon: GraduationCap },
  { to: "/community/classes", label: "Classes", Icon: Users },
  { to: "/community/adventure", label: "Adventures", Icon: Sparkles },
  { to: "/community/search", label: "Search", Icon: Search },
];

const PEOPLE = [
  { to: "/community/teachers", label: "Teachers", Icon: GraduationCap },
  { to: "/community/schools", label: "Schools", Icon: School },
  { to: "/community/students", label: "Students", Icon: UserRound },
  { to: "/community/parents", label: "Parents", Icon: Users2 },
];

export const SEARCH_PLACEHOLDER =
  "Search teachers, schools, students, parents, lessons, courses, classes and more…";

const NavGroup = ({
  heading,
  items,
  active,
  onNavigate,
}: {
  heading?: string;
  items: { to: string; label: string; Icon: typeof Compass }[];
  active?: string;
  onNavigate?: () => void;
}) => (
  <div>
    {heading && (
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-dash-surface/45">
        {heading}
      </p>
    )}
    <div className="space-y-1">
      {items.map(({ to, label, Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className={`flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-sm transition ${
            active === to
              ? "bg-dash-gold/15 font-semibold text-dash-gold"
              : "text-dash-surface/75 hover:bg-white/5 hover:text-dash-surface"
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
    <NavGroup heading="Discover" items={NETWORK} active={active} onNavigate={onNavigate} />
    <NavGroup heading="Discover people" items={PEOPLE} active={active} onNavigate={onNavigate} />
  </nav>
);


const CommunityShell = ({
  children,
  active,
  title,
  subtitle,
  initialQuery = "",
  showSearch = true,
}: {
  children: ReactNode;
  active?: string;
  title: string;
  subtitle?: string;
  initialQuery?: string;
  showSearch?: boolean;
}) => {
  const { username } = useCommunityIdentity();
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [drawer, setDrawer] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    navigate(`/community/search?q=${encodeURIComponent(query.trim())}`);
    setDrawer(false);
  };

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(160deg,hsl(222_47%_11%),hsl(222_44%_16%))] text-dash-surface">
      <div className="mx-auto flex w-full max-w-7xl">
        {/* Desktop navigation */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-white/10 px-4 py-6 lg:flex">
          <Link to="/community" className="flex items-center gap-2 px-2">
            <span className="rounded-full border border-sky-300/40 bg-dash-navy/50 px-3 py-1.5 text-sm font-semibold text-sky-100">
              Discover MathGPL
            </span>
          </Link>
          <div className="flex-1 overflow-y-auto">
            <NavList active={active} />
          </div>
          <div className="space-y-2">
            <Link
              to="/community/dashboard"
              className="flex min-h-[42px] items-center gap-3 rounded-xl border border-white/20 px-3 text-sm font-semibold text-dash-surface transition hover:bg-white/5"
            >
              <LayoutDashboard className="h-4 w-4" /> My Dashboard
            </Link>
            <Link
              to="/"
              className="flex min-h-[42px] items-center gap-3 rounded-xl border border-dash-gold/40 px-3 text-sm font-semibold text-dash-gold transition hover:bg-dash-navy/60"
            >
              <Home className="h-4 w-4" /> My workspace
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-white/10 px-4 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-dash-surface lg:hidden"
                aria-label="Open Community navigation"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                {subtitle && <p className="mt-1 max-w-2xl text-sm text-dash-surface/70">{subtitle}</p>}
                {username && <p className="mt-1 text-xs text-dash-surface/50">Signed in as @{username}</p>}
              </div>
            </div>

            {showSearch && (
              <form onSubmit={submit} className="mt-4 flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-surface/50" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={SEARCH_PLACEHOLDER}
                    aria-label="Search MathGPL Community"
                    className="min-h-[44px] w-full rounded-full border border-white/15 bg-dash-navy/40 pl-10 pr-4 text-sm text-dash-surface outline-none transition placeholder:text-dash-surface/40 focus:border-dash-gold/60"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center rounded-full bg-dash-gold px-5 text-sm font-semibold text-dash-navy transition hover:brightness-110"
                >
                  Search
                </button>
              </form>
            )}
          </header>

          <main className="px-4 pb-24 pt-6 sm:px-6">{children}</main>
        </div>
      </div>

      {/* Mobile / tablet drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close Community navigation"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-white/10 bg-[hsl(222_47%_12%)] px-4 py-6">
            <div className="flex items-center justify-between pb-4">
              <span className="text-sm font-semibold text-sky-100">MathGPL Community</span>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavList active={active} onNavigate={() => setDrawer(false)} />
            <Link
              to="/community/dashboard"
              onClick={() => setDrawer(false)}
              className="mt-6 flex min-h-[42px] items-center gap-3 rounded-xl border border-white/20 px-3 text-sm font-semibold"
            >
              <LayoutDashboard className="h-4 w-4" /> My Dashboard
            </Link>
            <Link
              to="/"
              onClick={() => setDrawer(false)}
              className="mt-2 flex min-h-[42px] items-center gap-3 rounded-xl border border-dash-gold/40 px-3 text-sm font-semibold text-dash-gold"
            >
              <Home className="h-4 w-4" /> My workspace
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityShell;
