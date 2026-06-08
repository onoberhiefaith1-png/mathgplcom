import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Presentation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNotebook } from "@/hooks/useNotebook";
import { renderMathInline } from "@/lib/notebook/mathRender";

/**
 * Participant SmartBoard — view-only. Subscribes to class_smartboard_state
 * for the class and renders the teacher's active notebook as a stream of
 * read-only lines. No editing surface, no toolbars, no controls.
 */
const StudentSmartBoardPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [className, setClassName] = useState<string>("");

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

      const [{ data: cls }, { data: state }] = await Promise.all([
        supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
        supabase.from("class_smartboard_state").select("notebook_id").eq("class_id", classId).maybeSingle(),
      ]);
      if (cancelled) return;
      setClassName(cls?.name ?? "");
      setActiveNotebookId(state?.notebook_id ?? null);
      setAuthorized(true);
    })();
    return () => { cancelled = true; };
  }, [classId, navigate]);

  // Follow teacher's active-notebook changes in realtime.
  useEffect(() => {
    if (!classId || !authorized) return;
    const ch = supabase
      .channel(`smartboard-state-${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_smartboard_state", filter: `class_id=eq.${classId}` },
        (payload: { new?: { notebook_id?: string } | null }) => {
          const nid = payload.new?.notebook_id ?? null;
          setActiveNotebookId(nid);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [classId, authorized]);

  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading SmartBoard…
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
        {!activeNotebookId ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Your teacher hasn't opened the SmartBoard yet. This page will update automatically.
          </div>
        ) : (
          <ReadOnlyNotebookView notebookId={activeNotebookId} />
        )}
      </main>
    </div>
  );
};

const ReadOnlyNotebookView = ({ notebookId }: { notebookId: string }) => {
  const { notebook, sections, loading } = useNotebook(notebookId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!notebook) return null;

  return (
    <article
      className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur"
      // Pointer-events kept on for natural scrolling. No interactive children below.
    >
      <h2 className="mb-4 text-xl font-semibold">{notebook.title ?? "Untitled"}</h2>
      <div className="space-y-6">
        {sections.map((sec) => (
          <section key={sec.id} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {sec.title ?? sec.kind}
            </div>
            {sec.loose.map((b) => (
              <p key={b.id} className="whitespace-pre-wrap leading-relaxed">
                {renderMathInline(b.content_ascii ?? "")}
              </p>
            ))}
            {sec.subsections.map((ss, idx) => (
              <div key={ss.id} className="space-y-1 rounded-md border border-border/60 bg-background/30 p-3">
                {sec.subsections.length > 1 && (
                  <div className="text-xs text-muted-foreground">#{idx + 1}</div>
                )}
                {ss.blocks.map((b) => (
                  <p key={b.id} className="whitespace-pre-wrap leading-relaxed">
                    {b.kind !== "text" && (
                      <span className="mr-2 font-semibold capitalize text-muted-foreground">{b.kind}:</span>
                    )}
                    {renderMathInline(b.content_ascii ?? "")}
                  </p>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">View-only — your teacher controls the board.</p>
    </article>
  );
};

export default StudentSmartBoardPage;
