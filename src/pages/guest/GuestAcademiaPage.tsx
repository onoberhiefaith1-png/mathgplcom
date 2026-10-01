import { useEffect, useMemo, useState } from "react";
import { BookOpen, Gamepad2, PenLine, Play, Video } from "lucide-react";
import QuestionCardFace from "@/components/academia/QuestionCardFace";
import { useParams } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import GuestBoard from "@/components/guests/GuestBoard";
import GamePlayPage from "@/pages/game/GamePlayPage";
import { fetchGuestMediaUrl, fetchGuestPayload, type GuestAcademiaPayload } from "@/lib/guests/guestApi";
import { guestLinkName, guestLinkToken } from "@/lib/guests/guestSession";
import { setGuestMediaResolver } from "@/lib/courses/media";
import { GuestLoading, GuestNameGate, GuestUnavailable } from "./GuestGate";

const ytId = (url: string) => url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? null;
const embedUrl = (url: string): string => {
  const yt = ytId(url);
  if (yt) return `https://www.youtube.com/embed/${yt}?autoplay=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return url;
};
const isDirectVideo = (url: string) => !/youtu|vimeo/.test(url);

/** The Session video exactly as the teacher set it up: their thumbnail,
 * then the real player (YouTube/Vimeo embed or an uploaded file). */
const SessionVideo = ({ url, thumbnail, title }: { url: string; thumbnail?: string | null; title: string }) => {
  const [playing, setPlaying] = useState(false);
  const yt = ytId(url);
  const poster = thumbnail || (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
      {playing ? (
        isDirectVideo(url)
          ? <video src={url} controls autoPlay playsInline className="h-full w-full" />
          : <iframe title={title} src={embedUrl(url)} className="h-full w-full" allow="autoplay; fullscreen" allowFullScreen />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0" aria-label="Play video">
          {poster ? <img src={poster} alt="" className="h-full w-full object-cover" />
            : isDirectVideo(url) ? <video src={`${url}#t=0.5`} muted preload="metadata" playsInline className="h-full w-full object-cover" /> : null}
          <span className="absolute inset-0 flex items-center justify-center bg-background/20 transition group-hover:bg-background/10">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-foreground/80 bg-background/50 backdrop-blur">
              <Play className="ml-1 h-6 w-6" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
};

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
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(0,3fr)]">
            <section className="self-start rounded-2xl border border-border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-2 truncate text-sm font-semibold"><Video className="h-4 w-4 text-primary" /> {payload.title}</h2>
              {payload.videoUrl
                ? <SessionVideo url={payload.videoUrl} thumbnail={payload.thumbnailUrl} title={payload.title} />
                : <div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-muted text-xs text-muted-foreground">No video yet.</div>}
            </section>
            <section className="min-w-0 rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-lg font-semibold">Questions ({payload.activities.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {payload.activities.map((row, index) => (
                  <article key={row.id} className="overflow-hidden rounded-xl border border-border bg-background">
                    {row.imageUrl ? (
                      <div className="relative aspect-[4/3] bg-muted">
                        <img src={row.imageUrl} alt={row.title} className="h-full w-full object-cover" />
                        <span className="absolute left-2 top-2 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[11px] font-semibold">Question {index + 1}</span>
                      </div>
                    ) : (
                      <QuestionCardFace number={index + 1} design={row.design ?? null} title={row.title} />
                    )}
                    <div className="p-3">
                      <h3 className="line-clamp-2 text-sm font-semibold">{row.title}</h3>
                      <div className="mt-3 flex gap-2">
                        <Button className="flex-1" disabled={!row.assessment} onClick={() => setOpen({ activityId: row.id, mode: "practice" })}><PenLine className="mr-2 h-4 w-4" /> Practice</Button>
                        {row.gamePayload && <Button className="flex-1" variant="secondary" onClick={() => setOpen({ activityId: row.id, mode: "play" })}><Gamepad2 className="mr-2 h-4 w-4" /> Play</Button>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </GuestNameGate>
  );
};

export default GuestAcademiaPage;