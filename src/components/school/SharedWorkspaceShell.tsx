import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, BookOpen, Compass, Eye, GraduationCap, Sparkles, Users } from "lucide-react";

import PersonAvatar from "@/components/accounts/PersonAvatar";
import WorkspaceSwitcher from "@/components/accounts/WorkspaceSwitcher";
import { useWorkspace } from "@/lib/accounts/useWorkspace";

/**
 * Chrome for the school's view of a connected teacher's Shared Workspace.
 *
 * The school sees exactly the five Teaching Hub sections the teacher operates —
 * only in view mode. There is no Building editing here: the Building belongs to
 * the school and is changed from the School Console, not from inside a member's
 * workspace.
 */

export type SharedSection = "hub" | "lesson-notes" | "smartboard" | "classes" | "adventure" | "skill-builder";

export const SHARED_SECTIONS = [
  { key: "lesson-notes" as const, label: "Lesson Notes", icon: BookOpen, path: "lesson-notes" },
  { key: "smartboard" as const, label: "Smartboard", icon: Sparkles, path: "smartboard" },
  { key: "classes" as const, label: "Classes", icon: Users, path: "classes" },
  { key: "adventure" as const, label: "Adventure", icon: Compass, path: "adventure" },
  { key: "skill-builder" as const, label: "Skill Builder", icon: GraduationCap, path: "skill-builder" },
];

const SharedWorkspaceShell = ({
  userId,
  person,
  section,
  title,
  subtitle,
  children,
}: {
  userId: string;
  person?: { displayName: string; username: string | null; avatarUrl: string | null } | null;
  section: SharedSection;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) => {
  const { active } = useWorkspace();
  const base = `/school/teachers/${userId}`;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <Link
          to={section === "hub" ? "/school/teachers" : base}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {section === "hub" ? "Back to teachers" : "Back to shared workspace"}
        </Link>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Shared Workspace · {active?.name ?? "School"}
        </span>
        <WorkspaceSwitcher compact />
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <PersonAvatar name={person?.displayName ?? "Teacher"} avatarPath={person?.avatarUrl ?? null} size={52} />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">
                {person?.displayName ?? "Teacher"}
                {title ? <span className="text-muted-foreground"> · {title}</span> : null}
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {person?.username ? `@${person.username}` : "Teacher account"} · Teaching Hub inside{" "}
                {active?.name ?? "this school"}
              </p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
              <Eye className="h-3.5 w-3.5" /> View only
            </span>
          </div>
          {subtitle && <p className="mt-3 max-w-3xl text-xs text-muted-foreground">{subtitle}</p>}
        </section>

        <nav className="mt-4 flex flex-wrap gap-2">
          {SHARED_SECTIONS.map(({ key, label, icon: Icon, path }) => (
            <Link
              key={key}
              to={`${base}/${path}`}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3.5 text-sm transition ${
                section === key
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-card/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>

        <div className="mt-5">{children}</div>
      </main>
    </div>
  );
};

export default SharedWorkspaceShell;
