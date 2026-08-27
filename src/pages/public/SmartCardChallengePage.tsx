// Smart Card Challenge — the existing Student Smartboard, opened by anyone on
// the internet. No class, no assignment, no teacher presence required.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "@/lib/router-compat";
import { ArrowLeft, Loader2, Trophy, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PresentationView from "@/components/smartboard/PresentationView";
import { buildAssessmentBoardSource } from "@/lib/assessments/assessmentBoardSource";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPublicCard, formatDuration, loadRememberedIdentity, newParticipantKey,
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
  const [renaming, setRenaming] = useState(false);

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

  // A public Smart Card is a doorway into one problem: nobody is asked to sign
  // in or choose a name first. Signed-in Smartboard profiles keep their
  // username, a remembered guest keeps theirs, everyone else gets an automatic
  // guest name so Start Challenge lands straight on the board.
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
      if (saved) { setIdentity(saved); return; }
      setIdentity({
        participantKey: newParticipantKey(),
        displayName: `Guest ${Math.floor(1000 + Math.random() * 9000)}`,
        remembered: false,
      });
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

  // The identity is minted automatically, so this is a blink, never a gate.
  if (!identity) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening challenge…
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2 text-xs">
        <a
          href={`/c/${payload.card.slug}${preview ? "?preview=1" : ""}`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Smart Card
        </a>
        <span className="font-semibold">{payload.card.title}</span>
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = guestName.trim();
              if (name) {
                const next = { ...identity, displayName: name };
                setIdentity(next);
                if (identity.remembered) rememberIdentity(next);
              }
              setRenaming(false);
            }}
            className="flex items-center gap-1"
          >
            <Input
              autoFocus
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your username"
              maxLength={40}
              className="h-7 w-40 text-xs"
            />
            <Button size="sm" type="submit" className="h-7">Save</Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => { setGuestName(identity.displayName); setRenaming(true); }}
            className="text-muted-foreground hover:underline"
            title="Change the name shown on the leaderboard"
          >
            <UserRound className="mr-1 inline h-3 w-3" />
            {identity.displayName}
            {identity.remembered && <span className="ml-1 text-[10px] uppercase tracking-wide">· profile</span>}
          </button>
        )}
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
        </div>
      </div>


      <PresentationView
        key={`${payload.card.slug}:${identity.participantKey}`}
        role="student"
        backTo={`/c/${payload.card.slug}${preview ? "?preview=1" : ""}`}
        backLabel="Back to Smart Card"
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
