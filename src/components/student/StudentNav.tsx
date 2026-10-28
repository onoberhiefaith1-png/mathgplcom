import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Compass,
  Gamepad2,
  Home,
  Image as ImageIcon,
  Menu,
  Presentation,
  User,
  Users,
  X,
} from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";

type Dest = { label: string; short: string; icon: typeof Home; to: string };

/**
 * Hybrid responsive navigation for the Student Account.
 *
 *   phone   → fixed bottom bar (5 primary) + slide-up drawer for everything else
 *   tablet  → left icon+label rail, drawer opens as a full side menu
 *   desktop → nothing rendered; pages keep their existing header navigation
 *
 * The destinations are identical on every device.
 */

const classScoped = (classId: string | null) => {
  const base = classId ? `/student/class/${classId}` : "/student/classes";
  return {
    notes: classId ? `${base}/lesson-notes` : base,
    board: classId ? `${base}/smartboard` : base,
    reports: classId ? `${base}/report` : base,
    assignments: base,
    adventure: classId ? `${base}/adventures` : base,
    games: classId ? `${base}/games` : base,
    gallery: classId ? `${base}/gallery` : base,
  };
};

export const useActiveClassId = (): string | null => {
  const location = useLocation();
  return useMemo(() => {
    const m = (location.pathname ?? "").match(/\/student\/class(?:es)?\/([0-9a-fA-F-]{8,})/);
    return m ? m[1] : null;
  }, [location.pathname]);
};

const StudentNav = () => {
  const bp = useBreakpoint();
  const location = useLocation();
  const classId = useActiveClassId();
  const [drawer, setDrawer] = useState(false);

  // Any navigation closes the drawer — a tap should never leave it hanging.
  useEffect(() => setDrawer(false), [location.pathname]);

  const paths = classScoped(classId);

  const primary: Dest[] = [
    { label: "Home", short: "Home", icon: Home, to: "/student/classes" },
    { label: "Classes", short: "Classes", icon: Users, to: "/student/classes" },
    { label: "SmartBoard", short: "Board", icon: Presentation, to: paths.board },
    { label: "Reports", short: "Reports", icon: BarChart3, to: paths.reports },
    { label: "Profile", short: "Me", icon: User, to: "/home" },
  ];

  const secondary: Dest[] = [
    { label: "Lesson Notes", short: "Notes", icon: BookOpen, to: paths.notes },
    { label: "Assignments", short: "Work", icon: ClipboardList, to: paths.assignments },
    { label: "Adventure", short: "Adventure", icon: Compass, to: paths.adventure },
    { label: "Games", short: "Games", icon: Gamepad2, to: paths.games },
    { label: "Gallery", short: "Gallery", icon: ImageIcon, to: paths.gallery },
    { label: "Join a class", short: "Join", icon: Users, to: "/student/classes" },
  ];

  const isActive = (to: string) => location.pathname === to;

  if (bp === "desktop") return null;

  const drawerPanel = drawer && (
    <div className="fixed inset-0 z-[80] flex" role="dialog" aria-modal="true" aria-label="More student tools">
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => setDrawer(false)}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <div
        className={
          bp === "phone"
            ? "relative mt-auto w-full rounded-t-3xl border-t border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-200"
            : "relative ml-auto h-full w-80 border-l border-border bg-card p-5 shadow-2xl animate-in slide-in-from-right duration-200"
        }
      >
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-base font-semibold">All tools</h2>
          <button
            type="button"
            onClick={() => setDrawer(false)}
            aria-label="Close menu"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {secondary.map((d) => (
            <Link
              key={d.label}
              to={d.to}
              className="flex min-h-[5.5rem] min-w-0 flex-col justify-between rounded-2xl border border-border bg-background/60 p-4 active:scale-[0.98]"
            >
              <d.icon className="h-6 w-6 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium">{d.label}</span>
            </Link>
          ))}
        </div>
        {!classId && (
          <p className="mt-4 text-xs text-muted-foreground">
            Open a class first to jump straight to its notes, board and activities.
          </p>
        )}
      </div>
    </div>
  );

  if (bp === "tablet") {
    return (
      <>
        <nav
          aria-label="Student navigation"
          className="fixed left-0 top-0 z-[60] flex h-full w-20 flex-col items-center gap-1 border-r border-border bg-card/80 py-4 backdrop-blur"
        >
          {primary.map((d) => (
            <Link
              key={d.label}
              to={d.to}
              aria-current={isActive(d.to) ? "page" : undefined}
              className={`flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-medium transition ${
                isActive(d.to) ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <d.icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate px-1">{d.short}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="More tools"
            className="mt-auto flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5 shrink-0" />
            <span>More</span>
          </button>
        </nav>
        {drawerPanel}
      </>
    );
  }

  return (
    <>
      <nav
        aria-label="Student navigation"
        className="fixed inset-x-0 bottom-0 z-[60] grid grid-cols-6 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        {primary.map((d) => (
          <Link
            key={d.label}
            to={d.to}
            aria-current={isActive(d.to) ? "page" : undefined}
            className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition active:scale-95 ${
              isActive(d.to) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <d.icon className="h-5 w-5 shrink-0" />
            <span className="max-w-full truncate">{d.short}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="More tools"
          className="flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium text-muted-foreground active:scale-95"
        >
          <Menu className="h-5 w-5 shrink-0" />
          <span>More</span>
        </button>
      </nav>
      {drawerPanel}
    </>
  );
};

export default StudentNav;
