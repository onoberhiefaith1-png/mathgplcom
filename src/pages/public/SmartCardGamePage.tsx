// Smart Card — public Game Challenge.
//
// The full Adventure stage, opened by anyone on the internet. Same canvas,
// same progress bars, same question boards and the same Student Smartboard.
// The only thing removed is the classroom: progress belongs to a participant
// key, not a class member.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import PresentationView from "@/components/smartboard/PresentationView";
import { getPreset } from "@/lib/games/progressPresets";
import { normalizeCanvas, type CanvasElement } from "@/lib/games/types";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { buildAssessmentBoardSource } from "@/lib/assessments/assessmentBoardSource";
import { fetchPublicGameBundle, fetchPublicGameProgress, type PublicGameBundle } from "@/lib/smartcards/publicGame";
import {
  loadRememberedIdentity, newParticipantKey, pingPresence, rememberIdentity,
  type CardIdentity,
} from "@/lib/smartcards/smartCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SmartCardGamePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const preview = params.get("preview") === "1";
  const navigate = useNavigate();

  const [bundle, setBundle] = useState<PublicGameBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<CardIdentity | null>(() => loadRememberedIdentity());
  const [guestName, setGuestName] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [solved, setSolved] = useState<Record<string, Record<string, number>>>({});
  const [openBarId, setOpenBarId] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    (async () => {
      if (!slug) return;
      setBundle(await fetchPublicGameBundle(slug));
      setLoading(false);
    })();
  }, [slug]);

  const refreshProgress = useCallback(async () => {
    if (!slug || !identity) return;
    const p = await fetchPublicGameProgress(slug, identity.participantKey);
    setScores(p.scores);
    setSolved(p.solved as Record<string, Record<string, number>>);
  }, [slug, identity]);

  useEffect(() => {
    if (!identity) return;
    startedAt.current = Date.now();
    void refreshProgress();
    const t = setInterval(() => { void refreshProgress(); }, 6000);
    return () => clearInterval(t);
  }, [identity, refreshProgress]);

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

  const boardByElement = useMemo(() => {
    const map = new Map<string, PublicGameBundle["boards"][number]>();
    for (const b of bundle?.boards ?? []) map.set(b.progressElementId, b);
    return map;
  }, [bundle]);

  // Bars fill from this visitor's own marks — there is no class to share with.
  const elements: CanvasElement[] = useMemo(() => {
    const canvas = normalizeCanvas(bundle?.game?.canvas);
    const flat: CanvasElement[] = [];
    for (const scene of canvas.scenes) flat.push(...scene.elements);
    return flat.map((el) => {
      if (el.kind !== "progress_bar" || !el.progress) return el;
      const board = boardByElement.get(el.id);
      if (!board) return el;
      return {
        ...el,
        progress: {
          ...el.progress,
          currentMarks: scores[board.assessmentId] ?? 0,
          totalMarks: Math.max(1, board.totalMarks),
        },
      };
    });
  }, [bundle, boardByElement, scores]);

  const playableBars = useMemo(
    () => elements.filter((e) => e.kind === "progress_bar" && boardByElement.has(e.id)),
    [elements, boardByElement],
  );

  const openBoard = openBarId ? boardByElement.get(openBarId) ?? null : null;
  const boardSource = useMemo(() => {
    if (!openBoard) return null;
    return buildAssessmentBoardSource({
      id: openBoard.assessmentId,
      title: openBoard.title,
      questions: openBoard.questions,
      total_marks: openBoard.totalMarks,
    } as any);
  }, [openBoard]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0a16] text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening game challenge…
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-100 text-slate-600">
        <h1 className="text-lg font-semibold">This game challenge isn't available</h1>
        <a className="text-sm underline" href="/live">Explore more with MathGPL Life</a>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-xl">
          <h1 className="text-lg font-bold text-slate-900">Welcome</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a username to enter the game.</p>
          <Input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Your username"
            maxLength={40}
            className="mt-4 bg-slate-100"
          />
          <Button
            className="mt-3 w-full"
            disabled={!guestName.trim()}
            onClick={() => {
              const next = {
                participantKey: newParticipantKey(),
                displayName: guestName.trim(),
                remembered: false,
              };
              setIdentity(next);
            }}
          >
            Continue as Guest
          </Button>
          <Button
            variant="outline"
            className="mt-2 w-full"
            disabled={!guestName.trim()}
            onClick={() => {
              const next = {
                participantKey: newParticipantKey(),
                displayName: guestName.trim(),
                remembered: true,
              };
              rememberIdentity(next);
              setIdentity(next);
            }}
          >
            Sign in to Smartboard
          </Button>
        </div>
      </div>
    );
  }

  // Solving a question replaces the stage with the existing Student Smartboard.
  if (openBoard && boardSource && activeQuestion) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2 text-xs">
          <Button size="sm" variant="ghost" onClick={() => { setActiveQuestion(null); void refreshProgress(); }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to game
          </Button>
          <span className="font-semibold">{openBoard.title}</span>
          <span className="text-muted-foreground">{identity.displayName}</span>
          {preview && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700">Preview — not counted</span>
          )}
        </div>
        <PresentationView
          key={`${openBoard.assessmentId}:${activeQuestion}:${identity.participantKey}`}
          role="student"
          source={boardSource}
          assessmentId={openBoard.assessmentId}
          classId={null}
          workspace="adventure"
          boardStudentId={identity.participantKey}
          boardQuestionId={activeQuestion}
          smartCardSlug={bundle.card.slug}
          participantKey={identity.participantKey}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0b0a16] text-foreground">
      <header className="flex items-center justify-between gap-3 px-5 py-3">
        <button
          type="button"
          onClick={() => navigate(`/c/${bundle.card.slug}${preview ? "?preview=1" : ""}`)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Card
        </button>
        <h1 className="truncate text-base font-semibold">{bundle.game.title}</h1>
        <div className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold tabular-nums text-primary">
          {Object.values(scores).reduce((a, b) => a + b, 0)} /{" "}
          {bundle.boards.reduce((a, b) => a + b.totalMarks, 0)}
        </div>
      </header>

      <main className="w-full px-4 pb-8">
        <div className="mx-auto flex w-full max-w-[1400px] gap-4">
          <div className="relative w-full origin-top" style={{ width: openBoard ? "80%" : "100%" }}>
            <div className="pointer-events-none">
              <GameCanvas elements={elements} selectedId={null} editable={false} />
            </div>

            <div className="pointer-events-none absolute inset-0 z-30">
              {playableBars.map((bar) => {
                const aspect = getPreset(bar.progress?.presetId)?.aspect ?? 0.5;
                return (
                  <button
                    key={bar.id}
                    type="button"
                    onClick={() => setOpenBarId(bar.id)}
                    aria-label="Open questions"
                    className="pointer-events-auto absolute rounded-lg outline-none ring-1 ring-primary/40 transition hover:ring-2 hover:ring-primary/80"
                    style={{
                      left: `${bar.x * 100}%`,
                      top: `${bar.y * 100}%`,
                      width: `${bar.scale * 100}%`,
                      aspectRatio: String(aspect),
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                );
              })}
            </div>

            {playableBars.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 mx-auto w-fit rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
                This game has no question bars yet.
              </div>
            )}
          </div>

          {openBoard && (
            <aside className="w-[20%] min-w-[240px] rounded-xl border border-border bg-card/80 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-xs font-semibold">{openBoard.title}</div>
                <button
                  type="button"
                  onClick={() => setOpenBarId(null)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border hover:bg-accent"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {openBoard.questions.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No questions yet.</p>
              ) : (
                <ul className="space-y-2">
                  {openBoard.questions.map((q, i) => {
                    const marks = (q.lines ?? []).reduce((a, l) => a + (Number(l.marks) || 0), 0);
                    const mySolved = solved[openBoard.assessmentId] ?? {};
                    const score = (q.lines ?? []).reduce((sum, line, idx) => {
                      const slot = `${q.id}:${(line as any).lineId ?? idx}`;
                      return sum + (Number(mySolved[slot]) || 0);
                    }, 0);
                    return (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => setActiveQuestion(q.id)}
                          className="block w-full rounded-lg border border-border bg-background/50 p-2.5 text-left transition hover:border-primary/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold">Question {i + 1}</div>
                            {score >= marks && marks > 0 && (
                              <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(142 70% 45%)" }} />
                            )}
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                            {q.questionText ? renderMathInline(q.questionText) : "Tap to solve"}
                          </div>
                          <div className="mt-1.5 text-right text-[10px] tabular-nums text-primary">
                            {score} / {marks}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>
          )}
        </div>
      </main>

      <footer className="pb-8 text-center text-xs text-muted-foreground">
        <a href="/live" className="underline underline-offset-2">Explore more with MathGPL Life</a>
      </footer>
    </div>
  );
};

export default SmartCardGamePage;
