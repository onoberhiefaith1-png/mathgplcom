import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";
import SchedulePlanPanel from "@/components/schedule/SchedulePlanPanel";
import { supabase } from "@/integrations/supabase/client";
import { hydrateSession, querySessions, formatRoomSchedule } from "@/lib/live/sessions";

/**
 * A Live room's teaching plan — the same Schedule structure a Class uses. The
 * room's own day/time and platform settings stay in Room Settings.
 */
const SessionSchedulePage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/live/sessions/${sessionId}/schedule`);
        return;
      }
      const row = await querySessions<Record<string, unknown>>((cols) =>
        supabase.from("sessions").select(cols).eq("id", sessionId).maybeSingle() as never,
      );
      if (cancelled) return;
      if (!row) {
        navigate("/live/sessions");
        return;
      }
      const session = hydrateSession(row);
      setTitle(session.title);
      setScheduleText(formatRoomSchedule(session));
      setIsOwner(session.owner_id === userData.user.id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link
          to={`/live/sessions/${sessionId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Room
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Schedule</h1>
        <div className="w-16" />
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
              <div className="text-base font-semibold">{title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{scheduleText}</div>
            </div>

            <section className="space-y-4 rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
              <div>
                <h2 className="text-lg font-semibold">Teaching plan</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  What you will teach on each date. Your audience sees this before you go live.
                </p>
              </div>
              {sessionId && <SchedulePlanPanel scope="session" scopeId={sessionId} canEdit={isOwner} />}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default SessionSchedulePage;
