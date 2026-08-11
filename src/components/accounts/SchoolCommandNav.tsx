import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CreditCard,
  GraduationCap,
  Globe2,
  Inbox,
  LayoutDashboard,
  LineChart,
  Settings,
  Shield,
  UserCircle,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Item = { to: string; label: string; blurb: string; icon: LucideIcon };

/**
 * The School Console navigation.
 *
 * Large, clearly labelled controls rather than cramped pills: an administrator
 * should be able to see, in words, what each part of the school does.
 */
const ITEMS: Item[] = [
  { to: "/school", label: "Dashboard", blurb: "The school at a glance.", icon: LayoutDashboard },
  {
    to: "/school/teachers",
    label: "Teachers",
    blurb: "View all teachers connected to this school and open their individual school workspaces.",
    icon: GraduationCap,
  },
  {
    to: "/school/students",
    label: "Students",
    blurb: "View all students belonging to this school and open their individual school workspaces.",
    icon: Users,
  },
  {
    to: "/school?tab=reports",
    label: "Reports",
    blurb: "The combined academic progress of the entire school.",
    icon: BarChart3,
  },
  {
    to: "/school?tab=analytics",
    label: "Analytics",
    blurb: "School-wide activity and performance analytics.",
    icon: LineChart,
  },
  {
    to: "/school?tab=accounts",
    label: "Accounts",
    blurb: "School account information and related account settings.",
    icon: Shield,
  },
  {
    to: "/school?tab=billing",
    label: "Billing",
    blurb: "School subscription and billing information.",
    icon: CreditCard,
  },
  {
    to: "/requests",
    label: "Requests",
    blurb: "Incoming and outgoing connection requests.",
    icon: Inbox,
  },
  {
    to: "/community/discover",
    label: "MathGPL Community",
    blurb: "Discover and connect with other members of the MathGPL community.",
    icon: Globe2,
  },
  {
    to: "/account",
    label: "Account & Go Live",
    blurb: "School identity, School Code and Go Live discoverability.",
    icon: UserCircle,
  },
  {
    to: "/teaching-hub/settings",
    label: "Settings",
    blurb: "School workspace settings.",
    icon: Settings,
  },
];

const SchoolCommandNav = () => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr ?? "" });
  const here = `${pathname}${search}`;

  return (
    <nav aria-label="School command centre" className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ITEMS.map(({ to, label, blurb, icon: Icon }) => {
        const active = here === to || (to === "/school/teachers" && pathname.startsWith("/school/teachers")) ||
          (to === "/school/students" && pathname.startsWith("/school/students"));
        return (
          <Link
            key={to + label}
            to={to}
            className={`group flex min-h-[88px] items-start gap-3 rounded-2xl border p-4 transition ${
              active
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
        );
      })}
    </nav>
  );
};

export default SchoolCommandNav;
