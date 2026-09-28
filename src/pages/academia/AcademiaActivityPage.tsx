/**
 * One Academia question card, opened: Practice (the assignment questions)
 * and, when a Game is attached, Play. Nothing else on the page.
 */
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, Gamepad2, Loader2, PenLine } from "lucide-react";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { loadActivity, startAttempt } from "@/lib/academia/api";

const AcademiaActivityPage = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const q = useQuery({ queryKey: ["academia-activity", activityId], enabled: !!activityId, queryFn: () => loadActivity(activityId!) });
  const a = q.data;
  // Older cards stored a Game on its own; treat its link as Play.
  const practice = a && a.kind !== "game" ? a.link_code : null;
  const play = a ? (a.kind === "game" ? a.link_code : a.game_link_code) : null;

  return (
    <WorkspaceLayout title={a?.title ?? "Academia"} collapsibleNav>
      <div className="mx-auto w-full max-w-4xl px-2 py-6">
        {a && (
          <Link to={`/academia/session/${a.session_id}`} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to session
          </Link>
        )}
        {q.isLoading ? (
          <div className="flex items-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening…</div>
        ) : !a ? (
          <p className="py-24 text-center text-sm text-muted-foreground">This activity could not be found.</p>
        ) : (
          <>
            <h1 className="mb-6 text-2xl font-semibold">{a.title}</h1>
            <div className="grid gap-4 sm:grid-cols-2">
              {practice && (
                <a href={`/a/${practice}`} onClick={() => void startAttempt(a.session_id, "practice", a.id)}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 transition hover:-translate-y-0.5 hover:border-primary/60">
                  <PenLine className="h-10 w-10 text-primary" />
                  <span className="text-lg font-semibold">Practice</span>
                  <span className="text-sm text-muted-foreground">Solve the questions</span>
                </a>
              )}
              {play && (
                <a href={`/gm/${play}`} onClick={() => void startAttempt(a.session_id, "play", a.id)}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 transition hover:-translate-y-0.5 hover:border-primary/60">
                  <Gamepad2 className="h-10 w-10 text-primary" />
                  <span className="text-lg font-semibold">Play</span>
                  <span className="text-sm text-muted-foreground">Play the Game</span>
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </WorkspaceLayout>
  );
};

export default AcademiaActivityPage;
