// Smart Card Challenge — the existing Student Smartboard, opened by anyone on
// the internet. No class, no assignment, no teacher presence required.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, Trophy, UserRound, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PresentationView from "@/components/smartboard/PresentationView";
import { buildAssessmentBoardSource } from "@/lib/assessments/assessmentBoardSource";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPublicCard, forgetIdentity, formatDuration, loadRememberedIdentity, newParticipantKey,
  pingPresence, rememberIdentity, reportProgress,
  type CardIdentity, type LeaderboardEntry, type PublicCardPayload,
} from "@/lib/smartcards/smartCards";

const SmartCardChallengePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  // Teacher preview runs the real flow but is never counted publicly.
  const preview = params.get("preview") === "1";
  const [payload, setPayload] = useState<PublicCardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<CardIdentity | null>(null);
  const [guestName, setGuestName] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [percent, setPercent] = useState(0);
  const [qualified, setQualified] = useState(false);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const p = await fetchPublicCard(slug);
      setPayload(p);
      setLeaderboard(p?.leaderboard ?? []);
      setLoading(false);
    })();
  }, [slug]);

  // Signed-in Smartboard profiles keep their username; guests choose one per card.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setIdentity({
          participantKey: data.user.id,
          displayName:
            (data.user.user_metadata?.display_name as string) ||
            (data.user.email ?? "Player").split("@")[0],
          remembered: true,
        });
        return;
      }
      const saved = loadRememberedIdentity();
      if (saved) setIdentity(saved);
    })();
  }, []);

  // Poll the public progress endpoint: it grades, qualifies and ranks.
  const poll = useCallback(async () => {
    if (!slug || !identity) return;
    const res = await reportProgress({
      slug,
      participantKey: identity.participantKey,
      displayName: identity.displayName,
      durationMs: Date.now() - startedAt.current,
      preview,
    });
    if (!res) return;
    setPercent(res.percent);
    setQualified(res.qualified);
    setLeaderboard(res.leaderboard ?? []);
  }, [slug, identity, preview]);

  // Presence heartbeat so the Challenge Dashboard can show who is solving now.
  useEffect(() => {
    if (!slug || !identity) return;
    const beat = () => {
      void pingPresence({
        slug,
        participantKey: identity.participantKey,
        displayName: identity.displayName,
        state: "solving",
        preview,
      });
    };
    beat();
    const t = setInterval(beat, 30_000);
    return () => clearInterval(t);
  }, [slug, identity, preview]);

  useEffect(() => {
    if (!identity) return;
    startedAt.current = Date.now();
    const t = setInterval(() => { void poll(); }, 6000);
    return () => clearInterval(t);
  }, [identity, poll]);

  const boardSource = useMemo(() => {
    if (!payload?.assessment) return null;
    return buildAssessmentBoardSource(payload.assessment as any);
  }, [payload]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening challenge…
      </div>
    );
  }

  if (!payload || !boardSource) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-100 text-slate-600">
        <h1 className="text-lg font-semibold">This challenge isn't available</h1>
        <a className="text-sm underline" href="/live">Explore more with MathGPL Life</a>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-xl">
          <h1 className="text-lg font-bold text-slate-900">Welcome</h1>
          <p className="mt-1 text-sm text-slate-500">Choose one option to start the challenge.</p>

          <div className="mt-5 space-y-2">
            <label className="text-xs font-medium text-slate-500">Continue as Guest</label>
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your username"
              className="bg-slate-100"
              maxLength={40}
            />
            <Button
              className="w-full"
              disabled={!guestName.trim()}
              onClick={() => setIdentity({
                participantKey: newParticipantKey(),
                displayName: guestName.trim(),
                remembered: false,
              })}
            >
              <UserRound className="mr-1 h-4 w-4" /> Continue as Guest
            </Button>
          </div>

          <div className="my-4 flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              const key = newParticipantKey();
              const name = guestName.trim() || "Player";
              // Smartboard profile: the username is remembered for future
              // Smart Cards. It does NOT sign anyone into the full platform.
              rememberIdentity({ participantKey: key, displayName: name, remembered: true });
              setIdentity({ participantKey: key, displayName: name, remembered: true });
            }}
            disabled={!guestName.trim()}
          >
            <LogIn className="mr-1 h-4 w-4" /> Sign in to Smartboard
          </Button>
          <p className="mt-2 text-[11px] text-slate-400">
            Signing in here only remembers your Smartboard username on this device.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2 text-xs">
        <span className="font-semibold">{payload.card.title}</span>
        <span className="text-muted-foreground">
          {identity.displayName}
          {identity.remembered && <span className="ml-1 text-[10px] uppercase tracking-wide">· profile</span>}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">{percent}%</span>
        {preview && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700">Preview — not counted</span>
        )}
        {qualified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-green-700">
            <Trophy className="h-3 w-3" /> Leaderboard qualified
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => void poll()}>Refresh score</Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { forgetIdentity(); setIdentity(null); setGuestName(""); }}
          >
            Switch player
          </Button>
        </div>
      </div>

      <PresentationView
        key={`${payload.card.slug}:${identity.participantKey}`}
        role="student"
        source={boardSource}
        assessmentId={payload.assessment?.id ?? null}
        classId={null}
        workspace="assignment"
        boardStudentId={identity.participantKey}
        boardQuestionId={payload.assessment?.questions?.[0]?.id ?? null}
        smartCardSlug={payload.card.slug}
        participantKey={identity.participantKey}
      />

      {leaderboard.length > 0 && (
        <div className="mx-auto max-w-xl px-4 py-6">
          <h2 className="mb-2 flex items-center gap-1 text-sm font-semibold">
            <Trophy className="h-4 w-4" /> Leaderboard — 100% only, fastest first
          </h2>
          <ol className="divide-y rounded-xl border bg-card text-sm">
            {leaderboard.map((e, i) => {
              const mine = e.displayName === identity.displayName;
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              return (
                <li
                  key={`${e.displayName}-${e.completedAt}-${i}`}
                  className={`flex items-center justify-between px-3 py-2 ${mine ? "bg-primary/5 font-medium" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 tabular-nums text-muted-foreground">{medal ?? i + 1}</span>
                    {e.displayName}
                    {mine && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">you</span>}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{formatDuration(e.durationMs)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}


      <footer className="pb-8 text-center text-xs text-muted-foreground">
        <a href="/live" className="underline underline-offset-2">Explore more with MathGPL Life</a>
      </footer>
    </div>
  );
};

export default SmartCardChallengePage;
