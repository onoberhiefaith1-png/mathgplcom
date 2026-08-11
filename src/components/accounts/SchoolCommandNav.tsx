import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CreditCard,
  GraduationCap,
  Globe2,
  Inbox,
  LayoutDashboard,
  LineChart,
  Settings,
  UserCircle,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Item = { to: string; label: string; blurb: string; icon: LucideIcon };

/**
 * The School Console navigation.
 *
 * A school account administers; it never teaches. There is no Teaching Hub
 * here. Six clearly labelled places do the school's work — Dashboard,
 * Building, Teachers, Students, Reports, Account — with the occasional tools
 * kept underneath so the main six stay unmistakable.
 */
const ITEMS: Item[] = [
  { to: "/school", label: "Dashboard", blurb: "The school at a glance.", icon: LayoutDashboard },
  {
    to: "/homepage/building",
    label: "Building",
    blurb: "The school's building and background. The school controls this in every shared workspace.",
    icon: Building2,
  },
  {
    to: "/school/teachers",
    label: "Teachers",
    blurb: "Teachers connected to this school, and their Shared Workspaces.",
    icon: GraduationCap,
  },
  {
    to: "/school/students",
    label: "Students",
    blurb: "Students belonging to this school.",
    icon: Users,
  },
  {
    to: "/school?tab=reports",
    label: "Reports",
    blurb: "The combined academic progress of the entire school.",
    icon: BarChart3,
  },
  {
    to: "/account",
    label: "Account",
    blurb: "School identity, School Code and Go Live discoverability.",
    icon: UserCircle,
  },
];

const SECONDARY: Item[] = [
  { to: "/requests", label: "Requests", blurb: "Connection requests.", icon: Inbox },
  { to: "/community/discover", label: "MathGPL Community", blurb: "Find teachers and schools.", icon: Globe2 },
  { to: "/school?tab=analytics", label: "Analytics", blurb: "School-wide activity.", icon: LineChart },
  { to: "/school?tab=billing", label: "Billing", blurb: "Subscription and billing.", icon: CreditCard },
  { to: "/teaching-hub/settings", label: "Settings", blurb: "School account settings.", icon: Settings },
];

const SchoolCommandNav = () => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr ?? "" });
  const here = `${pathname}${search}`;

  const isActive = (to: string) =>
    here === to ||
    (to === "/school/teachers" && pathname.startsWith("/school/teachers")) ||
    (to === "/school/students" && pathname.startsWith("/school/students"));

  return (
    <>
      <nav aria-label="School Console" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ to, label, blurb, icon: Icon }) => (
          <Link
            key={to + label}
            to={to}
            className={`group flex min-h-[88px] items-start gap-3 rounded-2xl border p-4 transition ${
              isActive(to)
                ? "border-primary/60 bg-primary/10 text-foreground shadow-sm"
                : "border-border bg-card/50 text-foreground hover:border-primary/40 hover:bg-card"
            }`}
          >
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold">{label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{blurb}</span>
            </span>
          </Link>
        ))}
      </nav>

      <nav aria-label="School Console tools" className="mb-8 flex flex-wrap gap-2">
        {SECONDARY.map(({ to, label, blurb, icon: Icon }) => (
          <Link
            key={to + label}
            to={to}
            title={blurb}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
              isActive(to)
                ? "border-primary/60 bg-primary/10"
                : "border-border bg-card/40 hover:border-primary/40 hover:bg-card"
            }`}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
};

export default SchoolCommandNav;
