// Academia Session Adventure — the same video Adventure player students use,
// opened for anyone allowed into the Session (students, teachers, owners).
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useParams } from "@/lib/router-compat";
import { enterActivity, loadActivity } from "@/lib/academia/api";
import GamePlayPage, { type AdventurePlayContext } from "@/pages/student/GamePlayPage";

const AcademiaAdventurePage = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const [ctx, setCtx] = useState<AdventurePlayContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!activityId) return;
    let alive = true;
    (async () => {
      try {
        const a = await loadActivity(activityId);
        if (!a || a.kind !== "adventure" || !a.ref_id) throw new Error("This Adventure could not be found.");
        if (alive) setSessionId(a.session_id);
        const entry = await enterActivity(a.id);
        if (!entry.ready || !entry.class_id) throw new Error("Ask your teacher to add this Adventure again.");
        if (alive) setCtx({
          classId: entry.class_id,
          gameId: a.ref_id,
          playHref: `/academia/adventure/${a.id}`,
          exitHref: `/academia/session/${a.session_id}`,
          exitLabel: "Session",
        });
      } catch (e) {
        if (alive) setError((e as Error).message || "This Adventure could not be opened.");
      }
    })();
    return () => { alive = false; };
  }, [activityId]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 p-8">
        <h1 className="text-xl font-semibold">Adventure</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex gap-2">
          <Link to={sessionId ? `/academia/session/${sessionId}` : "/academia"} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent">Back</Link>
          <Link to="/" className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent">Home</Link>
        </div>
      </div>
    );
  }
  if (!ctx) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  return <GamePlayPage key={ctx.gameId} context={ctx} />;
};

export default AcademiaAdventurePage;
