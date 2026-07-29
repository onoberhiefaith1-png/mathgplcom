// Challenge Dashboard — the public face of a Smart Card.
//
// This is the Assignment Dashboard workflow with the classroom removed: the
// same "here is the task, here is who is doing it, press start" shape, but the
// audience is the whole internet instead of a class list.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, Play, Trophy, Users, Zap, Target } from "lucide-react";
import SmartCardQuestion from "@/components/smartcards/SmartCardView";
import {
  fetchChallengeDashboard, formatDuration, loadRememberedIdentity, newParticipantKey,
  pingPresence, type CardStatsPublic, type PublicCardPayload,
} from "@/lib/smartcards/smartCards";

const VISITOR_KEY = "smartcard:visitor";

const visitorKey = (): string => {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const made = newParticipantKey();
    localStorage.setItem(VISITOR_KEY, made);
    return made;
  } catch {
    return newParticipantKey();
  }
};

const SmartCardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const preview = params.get("preview") === "1";
  const navigate = useNavigate();
  const [payload, setPayload] = useState<(PublicCardPayload & { stats: CardStatsPublic }) | null>(null);
  const [stats, setStats] = useState<CardStatsPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const me = useRef<string>(visitorKey());

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const p = await fetchChallengeDashboard(slug);
      setPayload(p);
      setStats(p?.stats ?? null);
      setLoading(false);
    })();
  }, [slug]);

  const beat = useCallback(async () => {
    if (!slug) return;
    const next = await pingPresence({
      slug,
      participantKey: me.current,
      displayName: loadRememberedIdentity()?.displayName,
      state: "visitor",
      preview,
    });
    if (next) setStats(next);
  }, [slug, preview]);

  useEffect(() => {
    void beat();
    const t = setInterval(() => { void beat(); }, 30_000);
    return () => clearInterval(t);
  }, [beat]);

  useEffect(() => {
    if (!payload) return;
    document.title = `${payload.card.title} — MathGPL Life Smart Card`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        "Solve this maths challenge on the MathGPL Smartboard — instant AI marking and a fastest-time leaderboard.",
      );
    }
  }, [payload]);

  const best = useMemo(() => payload?.leaderboard?.[0] ?? null, [payload]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading Smart Card…
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-100 text-slate-600">
        <h1 className="text-lg font-semibold">Smart Card not available</h1>
        <a className="text-sm underline" href="/live">Explore more with MathGPL Life</a>
      </div>
    );
  }

  const card = payload.card;
  const open = () => navigate(`/c/${card.slug}/solve${preview ? "?preview=1" : ""}`);

  const counters = [
    { label: "Total players", value: stats?.totalPlayers ?? 0, icon: Users },
    { label: "Perfect scores", value: stats?.perfectScores ?? 0, icon: Target },
    { label: "Solving now", value: stats?.currentlySolving ?? 0, icon: Zap },
    { label: "Visitors", value: stats?.visitors ?? 0, icon: Play },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        {preview && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
            Teacher preview — nothing you do here is counted or shown publicly.
          </div>
        )}

        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            MathGPL Life · Smart Card
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{card.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
            {card.topic && <span className="rounded-full bg-slate-100 px-2 py-0.5">{card.topic}</span>}
            {card.subtopic && <span className="rounded-full bg-slate-100 px-2 py-0.5">{card.subtopic}</span>}
            {card.difficulty && <span className="rounded-full bg-slate-100 px-2 py-0.5">{card.difficulty}</span>}
            <span className="rounded-full bg-slate-100 px-2 py-0.5">{card.totalMarks} marks</span>
            {card.publishedBy && <span className="rounded-full bg-slate-100 px-2 py-0.5">by {card.publishedBy}</span>}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <SmartCardQuestion presentation={card.presentation} scenes={card.geometry?.scenes ?? []} />
          </div>

          <button
            type="button"
            onClick={open}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Play className="h-4 w-4" /> Start Challenge
          </button>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counters.map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
              <c.icon className="mx-auto mb-1 h-4 w-4 text-slate-400" />
              <p className="text-xl font-bold tabular-nums text-slate-900">{c.value}</p>
              <p className="text-[11px] text-slate-500">{c.label}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-800">
            <Trophy className="h-4 w-4" /> Leaderboard — 100% only, fastest first
          </h2>
          {payload.leaderboard.length === 0 ? (
            <p className="text-sm text-slate-500">
              No one has scored 100% yet. {best ? "" : "Be the first."}
            </p>
          ) : (
            <ol className="divide-y text-sm">
              {payload.leaderboard.slice(0, 10).map((e, i) => (
                <li key={`${e.displayName}-${e.completedAt}-${i}`} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className="w-6 tabular-nums text-slate-400">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </span>
                    {e.displayName}
                  </span>
                  <span className="tabular-nums text-slate-500">{formatDuration(e.durationMs)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="pt-2 text-center text-xs text-slate-500">
          <a href="/live" className="underline underline-offset-2">Explore more with MathGPL Life</a>
        </footer>
      </div>
    </div>
  );
};

export default SmartCardPage;
