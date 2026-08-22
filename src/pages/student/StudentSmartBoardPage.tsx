import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Loader2, Presentation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveChannel } from "@/lib/stability/useLiveChannel";
import { usePolling } from "@/lib/stability/usePolling";

import PresentationView from "@/components/smartboard/PresentationView";

type ClassBoardState = {
  name: string;
  accessEnabled: boolean;
  notebookId: string | null;
};

/**
 * Participant SmartBoard — mirrors the teacher's REAL board. View-only by
 * default; if the teacher makes this student the Active Student, editing
 * rights are granted live (handled inside PresentationView via the shared
 * class_smartboard_state row). Access itself is gated by the class
 * smartboard_visibility flag and reflected in realtime.
 */
const StudentSmartBoardPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [accessEnabled, setAccessEnabled] = useState(false);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [className, setClassName] = useState<string>("");
  const lastLoadedRef = useRef<ClassBoardState | null>(null);

  const loadBoardState = useCallback(async (): Promise<ClassBoardState | null> => {
    if (!classId) return null;
    const { data: cls, error: clsError } = await supabase
      .from("classes")
      .select("name, smartboard_visibility")
      .eq("id", classId)
      .maybeSingle();
    if (clsError) {
      console.warn("[student-smartboard] class state load failed", clsError.message);
      return lastLoadedRef.current;
    }
    const access = (cls as { smartboard_visibility?: string } | null)?.smartboard_visibility === "student_access_enabled";

    const { data: state, error } = await supabase
      .from("class_smartboard_state")
      .select("notebook_id")
      .eq("class_id", classId)
      .maybeSingle();
    if (error) {
      console.warn("[student-smartboard] board state load failed", error.message);
      const next = { name: cls?.name ?? "", accessEnabled: access, notebookId: null };
      setClassName(next.name);
      setAccessEnabled(next.accessEnabled);
      setActiveNotebookId(null);
      lastLoadedRef.current = next;
      return next;
    }
    const next = { name: cls?.name ?? "", accessEnabled: access, notebookId: state?.notebook_id ?? null };
    setClassName(next.name);
    setAccessEnabled(next.accessEnabled);
    setActiveNotebookId(next.notebookId);
    lastLoadedRef.current = next;
    return next;
  }, [classId]);

  // Identity firewall + initial state load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/student/class/${classId}/smartboard`);
        return;
      }
      const { data: cls } = await supabase
        .from("classes")
        .select("owner_id")
        .eq("id", classId)
        .maybeSingle();
      const isOwner = (cls as { owner_id?: string } | null)?.owner_id === userData.user.id;
      const { data: membership } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!isOwner && !membership) { navigate("/join"); return; }

      await loadBoardState();
      if (cancelled) return;
      setAuthorized(true);
    })();
    return () => { cancelled = true; };
  }, [classId, navigate, loadBoardState]);

  // Follow the teacher's class-board row with one source of truth. One managed
  // subscription (replaced, never stacked) plus a visibility-aware safety poll
  // so a missed realtime event can never leave a student on a blank board.
  useLiveChannel({
    key: `student-class-smartboard-${classId ?? "none"}`,
    enabled: !!classId && !!authorized,
    build: (channel) => {
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_smartboard_state", filter: `class_id=eq.${classId}` },
          () => { void loadBoardState(); },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "classes", filter: `id=eq.${classId}` },
          () => { void loadBoardState(); },
        );
    },
    onJoined: () => { void loadBoardState(); },
  });

  usePolling("student-class-board", () => loadBoardState(), 4000, {
    enabled: !!classId && !!authorized,
  });


  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading SmartBoard…
      </div>
    );
  }

  // Live mirror of the teacher's real board (view-only unless made Active Student).
  if (accessEnabled && activeNotebookId) {
    return (
      <div className="relative h-screen min-h-screen w-screen overflow-hidden bg-background">
        <Link
          to={`/student/class/${classId}`}
          aria-label="Back to class"
          className="fixed left-3 top-3 z-50 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-foreground backdrop-blur hover:bg-background"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {className || "Class"}
        </Link>
        <PresentationView notebookId={activeNotebookId} classId={classId} role="student" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`/student/class/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {className || "Class"}
        </Link>
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold tracking-wide">
          <Presentation className="h-5 w-5" /> SmartBoard
        </h1>
        <div className="w-24" />
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-4">
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Your teacher hasn't opened the SmartBoard yet. This page will update automatically.
        </div>
      </main>
    </div>
  );
};

export default StudentSmartBoardPage;
