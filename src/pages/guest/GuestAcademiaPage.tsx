import { useEffect, useMemo, useState } from "react";
import { BookOpen, Gamepad2, PenLine } from "lucide-react";
import { useParams } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import GuestBoard from "@/components/guests/GuestBoard";
import GamePlayPage from "@/pages/game/GamePlayPage";
import { fetchGuestMediaUrl, fetchGuestPayload, type GuestAcademiaPayload } from "@/lib/guests/guestApi";
import { guestLinkName, guestLinkToken } from "@/lib/guests/guestSession";
import { setGuestMediaResolver } from "@/lib/courses/media";
import { GuestLoading, GuestNameGate, GuestUnavailable } from "./GuestGate";

type OpenState = { activityId: string; mode: "practice" | "play" } | null;

const GuestAcademiaPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const code = String(slug ?? "");
  const token = useMemo(() => guestLinkToken(), []);
  const [payload, setPayload] = useState<GuestAcademiaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<OpenState>(null);
  const [nameTick, setNameTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetchGuestPayload(code).then((result) => {
      if (alive && result?.kind === "academia_session") setPayload(result);
      if (alive) setLoading(false);
    });
    setGuestMediaResolver((path) => fetchGuestMediaUrl(code, path));
    return () => { alive = false; setGuestMediaResolver(null); };
  }, [code]);

  if (loading) return <GuestLoading label="Opening Academia Session…" />;
  if (!payload) return <GuestUnavailable message="This Session link is unavailable." />;
  const activity = payload.activities.find((row) => row.id === open?.activityId) ?? null;
  if (activity && open?.mode === "practice" && activity.assessment) {
    return <GuestBoard code={code} token={token} assessment={activity.assessment} videoConfig={activity.practiceVideo} backLabel="Back to Session" onBack={() => setOpen(null)} />;
  }
  if (activity && open?.mode === "play" && activity.gamePayload) {
    return <GamePlayPage guest={{ code, token, name: guestLinkName(), payload: activity.gamePayload, playVideo: activity.playVideo }} />;
  }

  return (
    <GuestNameGate askName={payload.askName} onDone={() => setNameTick((value) => value + 1)}>
      <main className="min-h-screen bg-background px-4 py-8" key={nameTick}>
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 border-b border-border pb-5">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><BookOpen className="h-4 w-4" /> Academia Session</p>
            <h1 className="text-3xl font-semibold">{payload.title}</h1>
            {payload.description && <p className="mt-2 text-sm text-muted-foreground">{payload.description}</p>}
          </header>
          {payload.videoUrl && <div className="mb-6 aspect-video overflow-hidden rounded-lg border border-border bg-muted"><video src={payload.videoUrl} controls className="h-full w-full" /></div>}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {payload.activities.map((row, index) => (
              <article key={row.id} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold text-primary">Question {index + 1}</p>
                <h2 className="mt-1 font-semibold">{row.title}</h2>
                <div className="mt-4 flex gap-2">
                  <Button className="flex-1" disabled={!row.assessment} onClick={() => setOpen({ activityId: row.id, mode: "practice" })}><PenLine className="mr-2 h-4 w-4" /> Practice</Button>
                  {row.gamePayload && <Button className="flex-1" variant="secondary" onClick={() => setOpen({ activityId: row.id, mode: "play" })}><Gamepad2 className="mr-2 h-4 w-4" /> Play</Button>}
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>
    </GuestNameGate>
  );
};

export default GuestAcademiaPage;