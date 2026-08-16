/**
 * The frame around someone else's workspace being viewed read-only.
 *
 * It adds nothing but a thin identity strip: below it, that person's own pages
 * render unchanged. Every write inside is refused by `ViewAsProvider`.
 */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Eye, Loader2 } from "lucide-react";

import { Link } from "@/lib/router-compat";
import { ViewAsProvider } from "@/lib/accounts/viewAs";
import { useSharedMember } from "@/lib/accounts/useSharedMember";
import { useTeacherStudentContext } from "@/lib/accounts/useTeacherStudentContext";
import { useChildren } from "@/lib/family/useFamily";
import { useDraggableTab } from "@/hooks/useDraggableTab";

function foldKey(userId: string, kind: string, viewer: string) {
  return `mgpl:viewing-frame-folded:${userId}:${kind}:${viewer}`;
}

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
  const section = kind === "student" ? "students" : "teachers";
  const asParent = viewer === "parent";
  const asTeacher = viewer === "teacher";
  const shared = useSharedMember(asParent ? "" : userId);
  const teacher = useTeacherStudentContext(userId, asTeacher);
  // A parent follows the whole child: every school, every class, one total.
  const family = useChildren();
  const child = family.children.find((c) => c.childUserId === userId) ?? null;

  const orgId = asParent ? null : asTeacher ? teacher.orgId : shared.orgId;
  const loading = asParent ? family.loading : asTeacher ? teacher.isLoading : shared.overview.isLoading;
  const name =
    (asParent ? child?.displayName : asTeacher ? teacher.name : shared.person?.displayName) ??
    (kind === "student" ? "this student" : "this teacher");
  const basePath = asParent
    ? `/family/children/${userId}`
    : asTeacher
      ? `/teaching-hub/students/${userId}`
      : `/school/${section}/${userId}`;
  const backTo = asParent ? "/family" : asTeacher ? "/teaching-hub/students" : basePath;
  const viewerLabel = asParent ? "Parent" : asTeacher ? "Teacher" : "School";

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

  const [folded, setFolded] = useState(false);
  const drag = useDraggableTab(`mgpl:viewing-frame-tab-x:${userId}:${kind}`);


  useEffect(() => {
    try {
      setFolded(sessionStorage.getItem(foldKey(userId, kind, viewer)) === "1");
    } catch {
      // sessionStorage may be unavailable in some environments.
    }
  }, [userId, kind, viewer]);

  useEffect(() => {
    try {
      sessionStorage.setItem(foldKey(userId, kind, viewer), folded ? "1" : "0");
    } catch {
      // ignore
    }
  }, [folded, userId, kind, viewer]);

  const exitLinkText = asParent
    ? "My children"
    : asTeacher
      ? "My students"
      : kind === "student"
        ? "Student workspace"
        : "Shared workspace";

  return (
    <div className="relative min-h-screen">
      {folded ? (
        <button
          type="button"
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.endDrag}
          onPointerCancel={drag.endDrag}
          onClick={() => {
            if (drag.wasDragged()) return;
            setFolded(false);
          }}
          title="Show workspace bar — drag left or right to move it"
          style={{ transform: `translateX(calc(-50% + ${drag.offsetX}px))` }}
          className={`absolute left-1/2 top-0 z-50 touch-none rounded-b-full border-x border-b border-amber-400/40 bg-amber-500/90 px-3 py-1 text-[10px] font-medium text-amber-50 shadow-md backdrop-blur transition-colors hover:bg-amber-500 ${drag.dragging ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <span className="inline-flex items-center gap-1">
            <ChevronDown className="h-3 w-3" />
            Workspace
          </span>
        </button>
      ) : (

        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/30 bg-amber-500/15 px-4 py-2 text-xs backdrop-blur">
          <span className="inline-flex items-center gap-2 text-amber-100">
            <Eye className="h-3.5 w-3.5" />
            Viewing {kind === "student" ? "Student" : "Teacher"} Workspace — Read Only ·{" "}
            <strong className="font-semibold">{name}</strong> · Viewing as {viewerLabel}
          </span>
          <div className="inline-flex items-center gap-2">
            <Link
              to={backTo}
              className="rounded-full border border-amber-300/40 px-3 py-1 text-amber-100 hover:bg-amber-400/20"
            >
              {exitLinkText}
            </Link>
            <button
              type="button"
              onClick={() => setFolded(true)}
              title="Hide workspace bar"
              className="inline-flex items-center rounded-full border border-amber-300/40 p-1 text-amber-100 transition hover:bg-amber-400/20"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
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
    </div>
  );
};

export default ViewingFrame;
