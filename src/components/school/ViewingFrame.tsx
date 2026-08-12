/**
 * The frame around someone else's workspace being viewed read-only.
 *
 * It adds nothing but a thin identity strip: below it, that person's own pages
 * render unchanged. Every write inside is refused by `ViewAsProvider`.
 */
import type { ReactNode } from "react";
import { Eye, Loader2 } from "lucide-react";

import { Link } from "@/lib/router-compat";
import { ViewAsProvider } from "@/lib/accounts/viewAs";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { useTeacherStudentContext } from "@/lib/accounts/useTeacherStudentContext";

const ViewingFrame = ({
  userId,
  kind = "teacher",
  viewer = "school",
  children,
}: {
  userId: string;
  /** Whose workspace is being viewed — a teacher's or a student's. */
  kind?: "teacher" | "student";
  /** Who is looking: a school administrator or a teacher. */
  viewer?: "school" | "teacher";
  children: ReactNode;
}) => {
  const section = kind === "student" ? "students" : "teachers";
  const shared = useSharedMember(userId);
  const teacher = useTeacherStudentContext(userId, viewer === "teacher");

  const asTeacher = viewer === "teacher";
  const orgId = asTeacher ? teacher.orgId : shared.orgId;
  const loading = asTeacher ? teacher.isLoading : shared.overview.isLoading;
  const name =
    (asTeacher ? teacher.name : shared.person?.displayName) ??
    (kind === "student" ? "this student" : "this teacher");
  const basePath = asTeacher ? `/teaching-hub/students/${userId}` : `/school/${section}/${userId}`;
  const backTo = asTeacher ? "/teaching-hub/students" : basePath;

  if (!asTeacher && !shared.orgId) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
          Switch to your school to open its workspaces.
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening workspace…
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/30 bg-amber-500/15 px-4 py-2 text-xs backdrop-blur">
        <span className="inline-flex items-center gap-2 text-amber-100">
          <Eye className="h-3.5 w-3.5" />
          Viewing {kind === "student" ? "Student" : "Teacher"} Workspace — Read Only ·{" "}
          <strong className="font-semibold">{name}</strong> · Viewing as {asTeacher ? "Teacher" : "School"}
        </span>
        <Link
          to={backTo}
          className="rounded-full border border-amber-300/40 px-3 py-1 text-amber-100 hover:bg-amber-400/20"
        >
          {asTeacher ? "My students" : kind === "student" ? "Student workspace" : "Shared workspace"}
        </Link>
      </div>
      <ViewAsProvider
        ownerId={userId}
        orgId={orgId}
        personName={asTeacher ? teacher.name : shared.person?.displayName ?? null}
        basePath={basePath}
        viewer={viewer}
        classIds={asTeacher ? teacher.classIds : null}
      >
        {children}
      </ViewAsProvider>
    </div>
  );
};

export default ViewingFrame;
