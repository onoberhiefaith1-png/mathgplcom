// Academia Session Adventure — the Adventure video with the Session's chosen
// Game playing over each learning point. No Smartboard opens here; the
// standalone Adventure player is untouched.
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { enterActivity, loadActivity } from "@/lib/academia/api";
import AcademiaAdventurePlayer from "@/components/academia/AcademiaAdventurePlayer";

const AcademiaAdventurePage = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<{ adventureId: string; gameId: string | null; sessionId: string } | null>(null);
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
        // Entering keeps access to the Adventure and its Game for this Session.
        await enterActivity(a.id).catch(() => null);
        if (!a.game_id) throw new Error("Ask your teacher to add a Game to this Adventure.");
        if (alive) setCtx({ adventureId: a.ref_id, gameId: a.game_id, sessionId: a.session_id });
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
  if (!ctx || !activityId) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  return (
    <AcademiaAdventurePlayer
      activityId={activityId}
      adventureId={ctx.adventureId}
      gameId={ctx.gameId}
      onExit={() => navigate(`/academia/session/${ctx.sessionId}`)}
    />
  );
};

export default AcademiaAdventurePage;
