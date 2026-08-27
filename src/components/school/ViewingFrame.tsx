/**
 * The frame around someone else's workspace being viewed read-only.
 *
 * It adds nothing but the read-only identity wrapper: below it, that person's
 * own pages render unchanged. Every write inside is refused by `ViewAsProvider`.
 */
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { ViewAsProvider } from "@/lib/accounts/viewAs";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { useTeacherStudentContext } from "@/lib/accounts/useTeacherStudentContext";
import { useChildren } from "@/lib/family/useFamily";

const ViewingFrame = ({
  userId,
  kind = "teacher",
  viewer = "school",
  children,
}: {
  userId: string;
  /** Whose workspace is being viewed — a teacher's or a student's. */
  kind?: "teacher" | "student";
  /** Who is looking: a school administrator, a teacher or a parent. */
  viewer?: "school" | "teacher" | "parent";
  children: ReactNode;
}) => {
  const asParent = viewer === "parent";
  const asTeacher = viewer === "teacher";
  const shared = useSharedMember(asParent ? "" : userId);
  const teacher = useTeacherStudentContext(userId, asTeacher);
  // A parent follows the whole child: every school, every class, one total.
  const family = useChildren();
  const child = family.children.find((c) => c.childUserId === userId) ?? null;

  const orgId = asParent ? null : asTeacher ? teacher.orgId : shared.orgId;
  const loading = asParent ? family.loading : asTeacher ? teacher.isLoading : shared.overview.isLoading;
  const basePath = asParent
    ? `/family/children/${userId}`
    : asTeacher
      ? `/teaching-hub/students/${userId}`
      : `/school/${kind === "student" ? "students" : "teachers"}/${userId}`;

  if (asParent && !loading && !child) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
          This child is not linked to your account.
        </p>
      </main>
    );
  }

  if (!asParent && !asTeacher && !shared.orgId) {
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
    <ViewAsProvider
      ownerId={userId}
      orgId={orgId}
      personName={asParent ? child?.displayName ?? null : asTeacher ? teacher.name : shared.person?.displayName ?? null}
      basePath={basePath}
      viewer={viewer}
      classIds={asTeacher ? teacher.classIds : null}
    >
      {children}
    </ViewAsProvider>
  );
};

export default ViewingFrame;
