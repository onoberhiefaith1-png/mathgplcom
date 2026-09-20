import { Link } from "@/lib/router-compat";
import {
  Boxes,
  Building2,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
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
    <div className="fixed bottom-10 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3">
      <Link
        to={to}
        aria-label={`Open ${look.title}`}
        className={`group inline-flex min-h-[72px] items-center gap-4 rounded-full border-2 px-5 py-3 backdrop-blur-xl transition duration-200 hover:scale-[1.03] sm:px-7 ${look.pill} ${look.glow}`}
      >
        <span
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${look.badge} sm:h-14 sm:w-14`}
        >
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
        </span>
        <span className="flex min-w-0 flex-col text-left">
          <span
            className={`text-lg font-extrabold tracking-tight sm:text-2xl ${look.title_}`}
          >
            {look.title}
          </span>
          <span className={`text-xs sm:text-sm ${look.blurb_}`}>{look.blurb}</span>
        </span>
        <ChevronRight
          className={`h-7 w-7 shrink-0 transition group-hover:translate-x-1 ${look.title_}`}
        />
      </Link>

      {hint && (
        <span className="hidden select-none text-sm font-semibold italic text-amber-200 drop-shadow-[0_0_10px_hsl(45_95%_60%/0.6)] sm:inline">
          Click here to start
        </span>
      )}
    </div>
  );
};

export default DashboardEntryCard;
