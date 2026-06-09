import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Presentation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import PresentationView from "@/components/smartboard/PresentationView";

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

  const loadBoardState = useCallback(async () => {
    if (!classId) return;
    const { data: state } = await supabase
      .from("class_smartboard_state")
      .select("notebook_id")
      .eq("class_id", classId)
      .maybeSingle();
    setActiveNotebookId(state?.notebook_id ?? null);
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
      const { data: membership } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!membership) { navigate("/join"); return; }

      const { data: cls } = await supabase
        .from("classes")
        .select("name, smartboard_visibility")
        .eq("id", classId)
        .maybeSingle();
      if (cancelled) return;
      setClassName(cls?.name ?? "");
      setAccessEnabled((cls as { smartboard_visibility?: string } | null)?.smartboard_visibility === "student_access_enabled");
      await loadBoardState();
      if (cancelled) return;
      setAuthorized(true);
    })();
    return () => { cancelled = true; };
  }, [classId, navigate, loadBoardState]);

  // Follow teacher's active-notebook changes in realtime.
  useEffect(() => {
    if (!classId || !authorized) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`smartboard-state-${classId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_smartboard_state", filter: `class_id=eq.${classId}` },
          (payload: { new?: { notebook_id?: string } | null }) => {
            setActiveNotebookId(payload.new?.notebook_id ?? null);
          },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, authorized]);

  // Follow SmartBoard access grant/removal in realtime — no refresh needed.
  useEffect(() => {
    if (!classId || !authorized) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`class-visibility-${classId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "classes", filter: `id=eq.${classId}` },
          (payload: { new?: { smartboard_visibility?: string } | null }) => {
            setAccessEnabled(payload.new?.smartboard_visibility === "student_access_enabled");
          },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, authorized]);

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
      <div className="relative">
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
