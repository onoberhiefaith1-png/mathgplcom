// Challenge Dashboard — the public face of a Smart Card (Layer 2).
//
// This is the Assignment Dashboard workflow with the classroom removed: the
// same "here is the task, here is who is doing it, press start" shape, but the
// audience is the whole internet instead of a class list. The creator arrives
// here from the editor with ?creator=1, which unlocks Copy/Share and runs any
// play-through in Creator Test Mode (never counted publicly).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import { Check, Copy, Loader2, Play, Share2, Trophy, Users, Zap, Target } from "lucide-react";
import SmartCardQuestion from "@/components/smartcards/SmartCardView";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchChallengeDashboard, formatDuration, loadRememberedIdentity, newParticipantKey,
  pingPresence, previewImageUrl, shareUrl, type CardStatsPublic, type PublicCardPayload,
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
  // The creator testing their own card is a preview run: fully functional
  // (marking, scoring, timing, reasoning) but excluded from all analytics.
  const creator = params.get("creator") === "1";
  const preview = creator || params.get("preview") === "1";
  const navigate = useNavigate();
  const [payload, setPayload] = useState<(PublicCardPayload & { stats: CardStatsPublic }) | null>(null);
  const [stats, setStats] = useState<CardStatsPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  // Share Card: a creator-only promotional VIEW of this same dashboard.
  // Never persisted, never visible to visitors — it only exists so the
  // teacher can take a screenshot to post beside the link.
  const [shareMode, setShareMode] = useState(false);
  const [promo, setPromo] = useState(DEFAULT_PROMO);
  const [editingPromo, setEditingPromo] = useState(false);
  const me = useRef<string>(visitorKey());

  useEffect(() => {
    if (!slug) return;
    try {
      const saved = localStorage.getItem(`${PROMO_KEY}:${slug}`);
      if (saved) setPromo(saved);
    } catch { /* private mode */ }
  }, [slug]);

  useEffect(() => {
    if (!slug || !creator) return;
    try { localStorage.setItem(`${PROMO_KEY}:${slug}`, promo); } catch { /* ignore */ }
  }, [slug, creator, promo]);

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
    const title = `${payload.card.title} — MathGPL Life Smart Card`;
    const description =
      "Solve this interactive mathematics challenge using the MathGPL Smartboard.";
    const url = shareUrl(payload.card.slug);
    const image = previewImageUrl(payload.card.slug);
    document.title = title;

    const meta = (selector: string, attr: "name" | "property", key: string, value: string) => {
      if (!value) return;
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
    };

    meta('meta[name="description"]', "name", "description", description);
    meta('meta[property="og:title"]', "property", "og:title", title);
    meta('meta[property="og:description"]', "property", "og:description", description);
    meta('meta[property="og:url"]', "property", "og:url", url);
    meta('meta[property="og:image"]', "property", "og:image", image);
    meta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    meta('meta[name="twitter:title"]', "name", "twitter:title", title);
    meta('meta[name="twitter:description"]', "name", "twitter:description", description);
    meta('meta[name="twitter:image"]', "name", "twitter:image", image);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            MathGPL Life
          </p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">
            This Smart Card does not exist
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            The link may be mistyped, or the card is no longer published by its author.
          </p>
          <a
            href="/live"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Explore MathGPL Life
          </a>
        </div>
      </div>
    );
  }

  const card = payload.card;
  const isGame = card.publishMode === "game";
  const link = shareUrl(card.slug);
  // Viewing is public; playing needs an account. A Game Challenge opens the
  // Adventure stage, a normal card opens the board — and if the visitor is not
  // signed in they go to sign-in first and are returned to this exact page.
  const open = async () => {
    const target = `/c/${card.slug}/${isGame ? "game" : "solve"}${preview ? "?preview=1" : ""}`;
    const { data } = await supabase.auth.getUser();
    if (data.user) { navigate(target); return; }
    navigate(`/auth?next=${encodeURIComponent(target)}`);
  };

  // Copy / Share put ONLY the short public URL on the clipboard — no HTML, no
  // image data. Platforms fetch the card snapshot from the page metadata.
  const copyCard = async () => {
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shareCard = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: card.title, url: link }); return; } catch { /* cancelled */ }
    }
    await copyCard();

  };

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
            {creator
              ? "Creator Test Mode — marking, scoring and timing all work, but nothing you do counts towards the public statistics."
              : "Teacher preview — nothing you do here is counted or shown publicly."}
          </div>
        )}

        {/* Sharing lives on the dashboard, not in the editor. */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyCard}
            className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy Smart Card
          </button>
          <button
            type="button"
            onClick={shareCard}
            className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <Share2 className="h-3.5 w-3.5" /> Share Smart Card
          </button>
          <span className="flex items-center rounded-full bg-white/70 px-3 py-1.5 text-xs tabular-nums text-slate-500">
            {link.replace(/^https?:\/\//, "")}
          </span>
        </div>


        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            MathGPL Life · {isGame ? "Game Challenge" : "Smart Card"}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{card.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
            {card.topic && <span className="rounded-full bg-slate-100 px-2 py-0.5">{card.topic}</span>}
            {card.subtopic && <span className="rounded-full bg-slate-100 px-2 py-0.5">{card.subtopic}</span>}
            {card.difficulty && <span className="rounded-full bg-slate-100 px-2 py-0.5">{card.difficulty}</span>}
            <span className="rounded-full bg-slate-100 px-2 py-0.5">{card.totalMarks} marks</span>
            {card.publishedBy && <span className="rounded-full bg-slate-100 px-2 py-0.5">by {card.publishedBy}</span>}
          </div>

          {/* The card itself is clickable — it is the entry point. */}
          <div
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") open(); }}
            className="mt-5 cursor-pointer rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <SmartCardQuestion presentation={card.presentation} scenes={card.geometry?.scenes ?? []} />
          </div>

          {isGame && (
            <p className="mt-3 text-center text-[11px] text-slate-500">
              Game Challenges require a Smartboard sign-in — rewards go to your personal gallery.
            </p>
          )}

          <button
            type="button"
            onClick={open}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Play className="h-4 w-4" /> {isGame ? "Enter Game Challenge" : "Start Challenge"}
          </button>
        </header>


        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counters.map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-xs">
              <c.icon className="mx-auto mb-1 h-4 w-4 text-slate-400" />
              <p className="text-xl font-bold tabular-nums text-slate-900">{c.value}</p>
              <p className="text-[11px] text-slate-500">{c.label}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
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
