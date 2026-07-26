// Student — play an assigned game.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Maximize2, Minimize2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import { getPreset } from "@/lib/games/progressPresets";
import { type GameRow } from "@/lib/games/types";
import type { GameBoard } from "@/lib/games/gameQuestions";
import { getPrefetched, prefetchGame, updatePrefetchedGame, waitForSceneReady } from "@/lib/games/prefetch";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { useAdventureSync } from "@/hooks/useAdventureSync";
import { useGameTimeBar } from "@/hooks/useGameTimeBar";

type MirrorSnapshot = Record<string, { current: number; required: number }>;

type Solved = Record<string, number>;
type PerQuestion = { score: number; status: "not_started" | "in_progress" | "completed" };

const perQuestionFrom = (board: GameBoard, solved: Solved | undefined): Record<string, PerQuestion> => {
  const out: Record<string, PerQuestion> = {};
  for (const q of board.questions) {
    const lines = q.lines ?? [];
    let score = 0, solvedCount = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] as { lineId?: string | number };
      const slot = `${q.id}:${line.lineId ?? i}`;
      const earned = solved?.[slot];
      if (earned != null) { solvedCount += 1; score += Number(earned) || 0; }
    }
    const status: PerQuestion["status"] =
      solvedCount === 0 ? "not_started" : solvedCount >= lines.length ? "completed" : "in_progress";
    out[q.id] = { score, status };
  }
  return out;
};

const statusLabel = (s: PerQuestion["status"]) =>
  s === "completed" ? "Completed" : s === "in_progress" ? "In Progress" : "Not Started";

const GamePlayPage = () => {
  const { classId, gameId } = useParams<{ classId: string; gameId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialBarId = searchParams.get("bar");
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<GameRow | null>(null);
  const [boards, setBoards] = useState<GameBoard[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [openBarId, setOpenBarId] = useState<string | null>(initialBarId);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mirror, setMirror] = useState<MirrorSnapshot | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const handleGameUpdated = useCallback((updated: GameRow) => {
    setGame(updated);
    if (classId && gameId) updatePrefetchedGame(classId, gameId, updated);
  }, [classId, gameId]);

  const groups = useAdventureGroups(classId, gameId);

  // Part 4 — a student's marks only raise their own group's bar.
  const barScope = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const g of groups.groups) {
      map.set(g.progress_element_id, groups.studentsByGroup.get(g.id) ?? new Set<string>());
    }
    return map;
  }, [groups.groups, groups.studentsByGroup]);

  const sync = useAdventureSync({
    classId,
    gameId,
    game,
    boards,
    currentUserId: me,
    onGameUpdated: handleGameUpdated,
    barScope,
  });


  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId || !gameId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { navigate(`/auth?redirect=/student/class/${classId}/games/${gameId}/play`); return; }
      setMe(userData.user.id);
      const { data: membership } = await supabase
        .from("class_members").select("class_id")
        .eq("class_id", classId).eq("user_id", userData.user.id).maybeSingle();
      if (!membership) { navigate("/join"); return; }

      let bundle = getPrefetched(classId, gameId);
      if (!bundle) bundle = await prefetchGame(classId, gameId);
      if (cancelled) return;
      if (!bundle) { navigate(`/student/class/${classId}`); return; }

      const { game: g, boards: b, urls } = bundle;

      await waitForSceneReady(g, urls);
      if (cancelled) return;

      setGame(g);
      setBoards(b);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, gameId, navigate]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await rootRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!classId || !gameId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`adventure-mirror-${classId}-${gameId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "bars" }, ({ payload }) => {
          setMirror((payload ?? {}) as MirrorSnapshot);
        })
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, gameId]);

  const timeBar = useGameTimeBar(gameId);

  const mirroredElements = useMemo(() => {
    const timeBarId = timeBar.elementId;
    return sync.elements.map((el) => {
      if (el.kind !== "progress_bar" || !el.progress) return el;
      if (timeBarId && el.id === timeBarId) {
        const segs = Math.max(1, Number(el.progress.segments) || 10);
        return { ...el, progress: { ...el.progress, currentMarks: timeBar.slotsLit(segs), totalMarks: segs } };
      }
      const snap = mirror?.[el.id];
      if (!snap) return el;
      return { ...el, progress: { ...el.progress, currentMarks: snap.current, totalMarks: snap.required } };
    });
  }, [sync.elements, mirror, timeBar.elementId, timeBar.slotsLit]);

  const playableBars = useMemo(
    () => mirroredElements.filter((e) => e.kind === "progress_bar" && sync.boardByElement.has(e.id)),
    [mirroredElements, sync.boardByElement],
  );
  const openBoard = sync.boardByElement.get(openBarId ?? "");
  const perQuestion = useMemo(
    () => (openBoard ? perQuestionFrom(openBoard, sync.mySolvedByAssessment[openBoard.assessmentId]) : {}),
    [openBoard, sync.mySolvedByAssessment],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening game…
      </div>
    );
  }

  const isOpen = !!openBarId && !!openBoard;

  return (
    <div ref={rootRef} className="min-h-screen w-full bg-[#0b0a16] text-foreground">
      <header className="flex items-center justify-between px-5 py-3">
        <Link to={`/student/class/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Class
        </Link>
        <h1 className="truncate text-base font-semibold">{game?.title}</h1>
        <div className="flex items-center gap-2">
          {(() => {
            const myScore = me
              ? boards.reduce((s, b) => s + (sync.scoresByAssessment[b.assessmentId]?.[me] ?? 0), 0)
              : 0;
            const myTarget = Math.ceil(sync.requiredContribution || 0);
            return (
              <div className="flex flex-col items-end leading-tight">
                <div className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-semibold tabular-nums text-primary">
                  {myScore} / {myTarget}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Your target</div>
              </div>
            );
          })()}

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="w-full px-4 pb-6">
        <div className="mx-auto flex w-full max-w-[1400px] gap-4 transition-all duration-300">
          <div
            className="relative origin-top transition-all duration-300 animate-fade-in"
            style={{ width: isOpen ? "80%" : "100%" }}
          >
            <div className="pointer-events-none">
              <GameCanvas elements={mirroredElements} selectedId={null} editable={false} />
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
                    className="pointer-events-auto absolute rounded-lg outline-none ring-1 ring-primary/40 transition hover:ring-2 hover:ring-primary/80 focus-visible:ring-2 focus-visible:ring-primary"
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
                Your teacher hasn't linked questions to this game's progress bars yet.
              </div>
            )}
            {timeBar.expired && (
              <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="rounded-xl border border-destructive/40 bg-background/90 px-6 py-4 text-center shadow-2xl">
                  <div className="text-sm font-semibold text-destructive">Time expired</div>
                  <div className="mt-1 text-xs text-muted-foreground">Wait for your teacher to add time or reset the timer.</div>
                </div>
              </div>
            )}
          </div>

          {isOpen && openBoard && (
            <aside
              className="flex-shrink-0 rounded-2xl border border-border bg-card/70 p-4 backdrop-blur transition-all duration-300"
              style={{ width: "20%", minWidth: 260 }}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Questions</div>
                  <div className="truncate text-sm font-semibold">{openBoard.title}</div>
                </div>
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
                    const pq = perQuestion[q.id] ?? { score: 0, status: "not_started" as const };
                    return (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/student/class/${classId}/games/${gameId}/play?bar=${openBarId}`, { replace: true });
                            navigate(`/student/class/${classId}/assessment/${openBoard.assessmentId}?q=${q.id}&game=${gameId}&bar=${openBarId}&source=adventure`);
                          }}
                          className="block w-full rounded-lg border border-border bg-background/50 p-2.5 text-left transition hover:border-primary/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold">Question {i + 1}</div>
                            {pq.status === "completed" && (
                              <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(142 70% 45%)" }} />
                            )}
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                            {q.questionText ? renderMathInline(q.questionText) : "Tap to solve"}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">{statusLabel(pq.status)}</span>
                            <span className="tabular-nums text-primary">{pq.score} / {marks}</span>
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
    </div>
  );
};

export default GamePlayPage;
