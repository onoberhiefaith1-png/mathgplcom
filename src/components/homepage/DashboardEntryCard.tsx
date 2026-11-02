import { Link } from "@/lib/router-compat";
import {
  Boxes,
  Building2,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppRole } from "@/lib/accounts/roles";

type Look = {
  title: string;
  blurb: string;
  icon: LucideIcon;
  /** Tailwind classes for the glowing pill, its icon badge and the arrow. */
  pill: string;
  glow: string;
  badge: string;
  title_: string;
  blurb_: string;
};

/**
 * The one pronounced way into a role's own dashboard.
 *
 * Every other homepage tool lives at the top of the screen; this is the single
 * luminous call to action below the building, so a new visitor never has to
 * guess where to click first.
 */
const LOOKS: Record<AppRole, Look> = {
  platform_owner: {
    title: "Platform Console",
    blurb: "Manage and build your content",
    icon: Boxes,
    pill: "border-sky-300/70 bg-gradient-to-r from-blue-700/80 via-blue-600/70 to-indigo-700/80",
    glow: "shadow-[0_0_30px_hsl(214_90%_60%/0.55),inset_0_1px_0_hsl(214_100%_90%/0.35)]",
    badge: "border-sky-200/60 bg-blue-900/70 text-sky-200",
    title_: "text-white",
    blurb_: "text-sky-100/85",
  },
  co_admin: {
    title: "Platform Console",
    blurb: "Manage and build your content",
    icon: Boxes,
    pill: "border-sky-300/70 bg-gradient-to-r from-blue-700/80 via-blue-600/70 to-indigo-700/80",
    glow: "shadow-[0_0_30px_hsl(214_90%_60%/0.55),inset_0_1px_0_hsl(214_100%_90%/0.35)]",
    badge: "border-sky-200/60 bg-blue-900/70 text-sky-200",
    title_: "text-white",
    blurb_: "text-sky-100/85",
  },
  school: {
    title: "School Console",
    blurb: "Manage teachers, students and classes",
    icon: Building2,
    pill: "border-sky-300/70 bg-gradient-to-r from-blue-700/80 via-blue-600/70 to-indigo-700/80",
    glow: "shadow-[0_0_30px_hsl(214_90%_60%/0.55),inset_0_1px_0_hsl(214_100%_90%/0.35)]",
    badge: "border-sky-200/60 bg-blue-900/70 text-sky-200",
    title_: "text-white",
    blurb_: "text-sky-100/85",
  },
  teacher: {
    title: "Teaching Hub",
    blurb: "Create, assign and track learning",
    icon: GraduationCap,
    pill: "border-sky-300/70 bg-gradient-to-r from-blue-700/80 via-blue-600/70 to-indigo-700/80",
    glow: "shadow-[0_0_30px_hsl(214_90%_60%/0.55),inset_0_1px_0_hsl(214_100%_90%/0.35)]",
    badge: "border-sky-200/60 bg-blue-900/70 text-sky-200",
    title_: "text-white",
    blurb_: "text-sky-100/85",
  },
  parent: {
    title: "Parent Console",
    blurb: "Follow your children's learning",
    icon: HeartHandshake,
    pill: "border-sky-300/70 bg-gradient-to-r from-blue-700/80 via-blue-600/70 to-indigo-700/80",
    glow: "shadow-[0_0_30px_hsl(214_90%_60%/0.55),inset_0_1px_0_hsl(214_100%_90%/0.35)]",
    badge: "border-sky-200/60 bg-blue-900/70 text-sky-200",
    title_: "text-white",
    blurb_: "text-sky-100/85",
  },
  student: {
    title: "Student Hub",
    blurb: "Access your learning dashboard",
    icon: Users,
    pill: "border-sky-300/70 bg-gradient-to-r from-blue-700/80 via-blue-600/70 to-indigo-700/80",
    glow: "shadow-[0_0_30px_hsl(214_90%_60%/0.55),inset_0_1px_0_hsl(214_100%_90%/0.35)]",
    badge: "border-sky-200/60 bg-blue-900/70 text-sky-200",
    title_: "text-white",
    blurb_: "text-sky-100/85",
  },
};

const DashboardEntryCard = ({
  role,
  to,
  hint = true,
}: {
  role: AppRole;
  to: string;
  /** Show the hand-written "Click here to start" prompt beside the card. */
  hint?: boolean;
}) => {
  const look = LOOKS[role];
  const Icon = look.icon;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center px-3 sm:bottom-14">
      <div className="pointer-events-auto relative w-full max-w-[19.5rem] sm:max-w-[22.5rem]">
        {hint && (
          <span className="absolute left-1/2 top-0 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-900 shadow-[0_4px_14px_hsl(42_96%_50%/0.45)]">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Click to start
          </span>
        )}
        <Link
          to={to}
          aria-label={`Open ${look.title}`}
          className={`ink-lock group mt-1.5 flex w-full items-center gap-2.5 rounded-full border-2 px-2.5 py-1.5 backdrop-blur-xl transition duration-200 hover:scale-[1.02] sm:gap-3 sm:px-3.5 sm:py-2 ${look.pill} ${look.glow}`}
        >
          <span
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${look.badge} sm:h-10 sm:w-10`}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col text-left">
            <span className={`truncate text-[15px] font-extrabold leading-tight tracking-tight sm:text-base ${look.title_}`}>
              {look.title}
            </span>
            <span className={`truncate text-[11px] leading-tight sm:text-xs ${look.blurb_}`}>{look.blurb}</span>
          </span>
          <ChevronRight className={`h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 sm:h-5 sm:w-5 ${look.title_}`} />
        </Link>
      </div>
    </div>
  );
};

export default DashboardEntryCard;
