/**
 * One Academia question card, opened: Practice and, when a Game is attached,
 * Play. Both open DIRECTLY for the signed-in learner — no guest links.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@/lib/router-compat";
import { Gamepad2, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import AcademiaTopBar from "@/components/academia/AcademiaTopBar";
import { enterActivity, loadActivity, startAttempt } from "@/lib/academia/api";

const AcademiaActivityPage = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"practice" | "play" | null>(null);
  const q = useQuery({ queryKey: ["academia-activity", activityId], enabled: !!activityId, queryFn: () => loadActivity(activityId!) });
  const a = q.data;
  const direct = !!a?.assessment_id;
  const hasPlay = !!a?.game_id;

  const open = async (mode: "practice" | "play") => {
    if (!a) return;
    setBusy(mode);
    try {
      const entry = await enterActivity(a.id);
      if (!entry.ready || !entry.class_id) throw new Error("Ask your teacher to assign this question again.");
      void startAttempt(a.session_id, mode, a.id);
      if (mode === "practice") {
        const qs = new URLSearchParams({ academia: a.id });
        if (entry.question_key) qs.set("q", entry.question_key);
        navigate(`/academia/practice/${entry.class_id}/${entry.assessment_id}?${qs.toString()}`);
      } else {
        navigate(`/game/play/${entry.game_id}?classId=${entry.class_id}`);
      }
    } catch (e) {
      toast.error((e as Error).message || "This question could not be opened.");
      setBusy(null);
    }
  };

  return (
    <WorkspaceLayout title={a?.title ?? "Academia"} collapsibleNav>
      <div className="mx-auto w-full max-w-4xl px-2 py-6">
        <AcademiaTopBar
          back={a ? `/academia/session/${a.session_id}` : "/academia"}
          crumbs={[{ label: "Academia", to: "/academia" }, ...(a ? [{ label: "Session", to: `/academia/session/${a.session_id}` }, { label: a.title }] : [])]}
        />
        {q.isLoading ? (
          <div className="flex items-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening…</div>
        ) : !a ? (
          <p className="py-24 text-center text-sm text-muted-foreground">This activity could not be found.</p>
        ) : !direct ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
            This question was assigned the old way. Ask the teacher to assign it to this Session again.
          </p>
        ) : (
          <>
            <h1 className="mb-6 text-2xl font-semibold">{a.title}</h1>
            <div className={`grid gap-4 ${hasPlay ? "sm:grid-cols-2" : "max-w-md"}`}>
              <button type="button" disabled={!!busy} onClick={() => void open("practice")}
                className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 transition hover:-translate-y-0.5 hover:border-primary/60 disabled:opacity-60">
                {busy === "practice" ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <PenLine className="h-10 w-10 text-primary" />}
                <span className="text-lg font-semibold">Practice</span>
                <span className="text-sm text-muted-foreground">Solve the question</span>
              </button>
              {hasPlay && (
                <button type="button" disabled={!!busy} onClick={() => void open("play")}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 transition hover:-translate-y-0.5 hover:border-primary/60 disabled:opacity-60">
                  {busy === "play" ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <Gamepad2 className="h-10 w-10 text-primary" />}
                  <span className="text-lg font-semibold">Play</span>
                  <span className="text-sm text-muted-foreground">Play the Game</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </WorkspaceLayout>
  );
};

export default AcademiaActivityPage;
