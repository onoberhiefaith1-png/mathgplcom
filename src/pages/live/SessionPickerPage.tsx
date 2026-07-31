import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LiveSession, formatStartsAt, hydrateSession } from "@/lib/live/sessions";

/**
 * Gallery and Reports are session-scoped, so the Live dashboard sends the
 * teacher through a light picker that jumps into the chosen session.
 */
const SessionPickerPage = ({
  title,
  subtitle,
  target,
}: {
  title: string;
  subtitle: string;
  /** Sub-path inside /live/workspace/:classId, e.g. "gallery" or "report". */
  target: string;
}) => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/live/${target === "report" ? "reports" : "gallery"}`);
        return;
      }
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("owner_id", userData.user.id)
        .order("starts_at", { ascending: false, nullsFirst: false });
      if (cancelled) return;
      setSessions(((data ?? []) as Record<string, unknown>[]).map(hydrateSession));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, target]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/live" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> MathGPL Live
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">{title}</h1>
        <div className="w-32" />
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Radio className="h-6 w-6" />
            No sessions yet.
            <Link to="/live/sessions" className="text-primary hover:underline">
              Create your first session
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <Link
                key={s.id}
                to={`/live/workspace/${s.class_id}/${target}`}
                className="rounded-xl border border-border bg-card/40 p-4 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="truncate text-base font-semibold">{s.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatStartsAt(s.starts_at, s.time_zone)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SessionPickerPage;
