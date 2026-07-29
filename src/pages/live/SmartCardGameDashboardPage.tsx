// Smart Card — Game Challenge live dashboard (MathGPL Live only).
//
// The Teaching Hub Adventure dashboard is untouched: this Live version has no
// class, so there is no roster, no averaging and no "inactive" bucket. Every
// participant owns their own run; the Time Bar decides the winner.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Check, Copy, Loader2, Trophy, Eye, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import PresentationView from "@/components/smartboard/PresentationView";
import { TimeBarControl } from "@/components/adventures/TimeBarControl";
import { useGameTimeBar } from "@/hooks/useGameTimeBar";
import { normalizeCanvas, type CanvasElement } from "@/lib/games/types";
import { buildAssessmentBoardSource, type AssessmentLike } from "@/lib/assessments/assessmentBoardSource";
import { finalizePublicGame } from "@/lib/smartcards/publicGame";
import { loadSmartCard, requiredMarksFor, cardUrl, type SmartCardRow } from "@/lib/smartcards/smartCards";
import { Button } from "@/components/ui/button";

interface ResultRow {
  participant_key: string;
  display_name: string | null;
  score: number;
  required_marks: number;
  qualified_at: string | null;
  completion_ms: number | null;
  is_winner: boolean;
}

const fmtMs = (ms: number | null) => {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
};

const SmartCardGameDashboardPage = () => {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<SmartCardRow | null>(null);
  const [game, setGame] = useState<{ id: string; title: string; canvas: unknown } | null>(null);
  const [assessment, setAssessment] = useState<AssessmentLike | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<ResultRow | null>(null);

  const timeBar = useGameTimeBar(game?.id ?? null);

  useEffect(() => {
    (async () => {
      if (!cardId) return;
      const row = await loadSmartCard(cardId);
      if (!row) { navigate("/live"); return; }
      setCard(row);
      if (row.game_id) {
        const { data: g } = await supabase
          .from("games").select("id, title, canvas").eq("id", row.game_id).maybeSingle();
        setGame((g as any) ?? null);
      }
      if (row.assessment_id) {
        const { data: a } = await supabase
          .from("assessments").select("id, title, questions, notebook_id").eq("id", row.assessment_id).maybeSingle();
        setAssessment((a as unknown as AssessmentLike) ?? null);
      }
      setLoading(false);
    })();
  }, [cardId, navigate]);

  const refreshResults = useCallback(async () => {
    if (!cardId) return;
    const { data } = await supabase
      .from("smart_card_game_results" as never)
      .select("participant_key, display_name, score, required_marks, qualified_at, completion_ms, is_winner")
      .eq("card_id", cardId)
      .order("score", { ascending: false });
    setRows(((data ?? []) as unknown) as ResultRow[]);
  }, [cardId]);

  useEffect(() => {
    void refreshResults();
    const t = setInterval(() => { void refreshResults(); }, 5000);
    return () => clearInterval(t);
  }, [refreshResults]);

  // When the countdown hits zero the competition closes and winners are picked.
  useEffect(() => {
    if (!card?.slug || !timeBar.expired) return;
    void finalizePublicGame(card.slug).then(() => void refreshResults());
  }, [card?.slug, timeBar.expired, refreshResults]);

  const required = requiredMarksFor(card?.total_marks ?? 0, card?.pass_mark_pct ?? 100);
  const completed = rows.filter((r) => !!r.qualified_at);
  const inProgress = rows.filter((r) => !r.qualified_at);
  const winners = rows.filter((r) => r.is_winner);

  const elements: CanvasElement[] = useMemo(() => {
    const canvas = normalizeCanvas(game?.canvas);
    const flat: CanvasElement[] = [];
    for (const scene of canvas.scenes) flat.push(...scene.elements);
    return flat.map((el) => {
      if (el.kind !== "progress_bar" || !el.progress) return el;
      if (el.id === timeBar.elementId) {
        const segments = Math.max(1, el.progress.segments ?? 10);
        return {
          ...el,
          progress: {
            ...el.progress,
            currentMarks: timeBar.slotsLit(segments),
            totalMarks: segments,
          },
        };
      }
      if (el.id !== card?.game_progress_element_id) return el;
      const best = rows.reduce((m, r) => Math.max(m, Number(r.score) || 0), 0);
      return { ...el, progress: { ...el.progress, currentMarks: best, totalMarks: Math.max(1, required) } };
    });
  }, [game, timeBar, card?.game_progress_element_id, rows, required]);

  const boardSource = useMemo(
    () => (assessment ? buildAssessmentBoardSource(assessment) : null),
    [assessment],
  );

  if (loading || !card) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening Game Challenge dashboard…
      </div>
    );
  }

  if (viewing && boardSource && card.assessment_id) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center gap-3 border-b bg-card px-4 py-2 text-xs">
          <Button size="sm" variant="ghost" onClick={() => setViewing(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard
          </Button>
          <span className="font-semibold">{viewing.display_name ?? "Player"}</span>
          <span className="text-muted-foreground">{viewing.score} / {required} marks</span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setViewing(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <PresentationView
          key={viewing.participant_key}
          role="teacher"
          source={boardSource}
          assessmentId={card.assessment_id}
          classId={card.class_id}
          workspace="adventure"
          boardStudentId={viewing.participant_key}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-card/95 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/live/smart-cards/${card.id}`)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <h1 className="text-sm font-semibold">{card.title || "Game Challenge"}</h1>
        <span className="text-xs text-muted-foreground">{game?.title}</span>
        {/* Players always enter through the Smart Card, never straight into
            the game stage: card → Enter Game Challenge → Adventure → board. */}
        <span className="ml-auto flex items-center rounded-full bg-muted/40 px-3 py-1 text-[11px] tabular-nums text-muted-foreground">
          {cardUrl(card.slug).replace(/^https?:\/\//, "")}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(cardUrl(card.slug));
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
          Copy Smart Card
        </Button>
        <a
          className="text-xs underline underline-offset-2"
          href={cardUrl(card.slug)}
          target="_blank"
          rel="noreferrer"
        >
          Open Smart Card
        </a>

      </header>

      <div className="space-y-4 p-4">
        <section className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Pass mark", value: `${card.pass_mark_pct ?? 100}% · ${required} marks` },
            { label: "Participants", value: String(rows.length) },
            { label: "Qualified", value: String(completed.length) },
            { label: "Rewards", value: winners.length ? `${winners.length} winner(s)` : timeBar.expired ? "No winner" : "Pending" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-3">
              <div className="text-[11px] uppercase text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-sm font-semibold">{s.value}</div>
            </div>
          ))}
        </section>

        {game?.id && (
          <TimeBarControl gameId={game.id} barLabel="Progress Bar 1" segments={10} />
        )}

        <GameCanvas elements={elements} selectedId={null} editable={false} />

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-3">
            <div className="text-[11px] uppercase text-muted-foreground">In progress</div>
            <div className="text-2xl font-semibold">{inProgress.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Completed</div>
            <div className="text-2xl font-semibold">{completed.length}</div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Players</div>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No one has entered yet.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2">Player</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Progress</th>
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Work</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.participant_key} className="border-t">
                    <td className="py-2 font-medium">
                      {r.is_winner && <Trophy className="mr-1 inline h-3.5 w-3.5 text-amber-500" />}
                      {r.display_name ?? "Player"}
                    </td>
                    <td className="py-2 tabular-nums">{r.score} / {required}</td>
                    <td className="py-2 tabular-nums">
                      {Math.min(100, Math.round((Number(r.score) / Math.max(1, required)) * 100))}%
                    </td>
                    <td className="py-2 tabular-nums">{fmtMs(r.completion_ms)}</td>
                    <td className="py-2">
                      {r.qualified_at ? (
                        <span className="text-emerald-600">Completed</span>
                      ) : (
                        <span className="text-amber-600">In progress</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setViewing(r)}>
                        <Eye className="mr-1 h-3 w-3" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
};

export default SmartCardGameDashboardPage;
