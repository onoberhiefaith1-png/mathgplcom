// Smart Card — Game Challenge setup (MathGPL Live only).
//
// Between "choose a game" and "publish" the teacher maps THIS card's question
// to one progress bar. Bar 1 is always reserved for the event countdown, so a
// game needs at least two bars before a Game Challenge can exist.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Gamepad2, Loader2, Lock, Timer, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  listGameProgressBars, listPublishableGames, loadSmartCard, publishSmartCard,
  requiredMarksFor, saveSmartCard, type GameBarSlot, type SmartCardRow,
} from "@/lib/smartcards/smartCards";

const SmartCardGameSetupPage = () => {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();

  const [card, setCard] = useState<SmartCardRow | null>(null);
  const [games, setGames] = useState<{ id: string; title: string }[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [bars, setBars] = useState<GameBarSlot[]>([]);
  const [barsLoading, setBarsLoading] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [passPct, setPassPct] = useState(100);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    (async () => {
      if (!cardId) return;
      const [row, gs] = await Promise.all([loadSmartCard(cardId), listPublishableGames()]);
      if (!row) { navigate("/live"); return; }
      setCard(row);
      setGames(gs);
      setGameId(row.game_id ?? null);
      setChosen(row.game_progress_element_id ?? null);
      setPassPct(row.pass_mark_pct ?? 100);
      setLoading(false);
    })();
  }, [cardId, navigate]);

  const loadBars = useCallback(async () => {
    if (!gameId || !cardId) { setBars([]); return; }
    setBarsLoading(true);
    setBars(await listGameProgressBars(gameId, cardId));
    setBarsLoading(false);
  }, [gameId, cardId]);

  useEffect(() => { void loadBars(); }, [loadBars]);

  const timeBar = bars[0] ?? null;
  const questionBars = useMemo(() => bars.slice(1), [bars]);
  const totalMarks = card?.total_marks ?? 0;
  const required = requiredMarksFor(totalMarks, passPct);

  // Keep an invalid selection from surviving a game swap.
  useEffect(() => {
    if (chosen && !questionBars.some((b) => b.id === chosen && !b.takenBy)) {
      if (!questionBars.some((b) => b.id === chosen)) setChosen(null);
    }
  }, [questionBars, chosen]);

  const blocked =
    bars.length === 0
      ? "No Progress Bars exist in this Game. Please add Progress Bars before creating a Game Challenge."
      : bars.length === 1
        ? "No Question Progress Bar is available. Add another Progress Bar to this Game."
        : null;

  const publish = async () => {
    if (!card || !gameId || !chosen) return;
    setPublishing(true);
    try {
      await saveSmartCard(card.id, {
        publish_mode: "game",
        game_id: gameId,
        game_progress_element_id: chosen,
        pass_mark_pct: passPct,
      });
      const updated = await publishSmartCard({
        ...card,
        publish_mode: "game",
        game_id: gameId,
        game_progress_element_id: chosen,
        pass_mark_pct: passPct,
      });
      if (updated) navigate(`/live/smart-cards/${updated.id}/game-dashboard`);
    } catch (e) {
      const msg = (e as Error).message;
      toast({
        title: "Could not publish the Game Challenge",
        description:
          msg === "no_floating_lines"
            ? "Add floating numbers to the solution first — the challenge needs markable lines."
            : msg === "game_has_no_question_bar"
              ? "Add another progress bar to this game: bar 1 is reserved for the countdown."
              : msg === "no_progress_bar_selected"
                ? "Pick the progress bar this question belongs to."
                : msg,
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  if (loading || !card) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening Game Challenge setup…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card/95 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/live/smart-cards/${card.id}`)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <h1 className="flex items-center gap-2 text-sm font-semibold">
          <Gamepad2 className="h-4 w-4" /> Link Question to Progress Bar
        </h1>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="rounded-xl border bg-card p-4">
          <Label className="text-xs">Game</Label>
          <Select value={gameId ?? ""} onValueChange={(v) => { setGameId(v); setChosen(null); }}>
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue placeholder="Choose game" />
            </SelectTrigger>
            <SelectContent>
              {games.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {gameId && (
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Progress Bar Mapper</span>
              {barsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>

            {blocked ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {blocked}
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2">Progress Bar</th>
                    <th className="pb-2">Purpose</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {timeBar && (
                    <tr className="border-t">
                      <td className="py-2 font-medium">{timeBar.label}</td>
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Timer className="h-3.5 w-3.5" /> Time (locked)
                        </span>
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        <Lock className="ml-auto h-3.5 w-3.5" />
                      </td>
                    </tr>
                  )}
                  {questionBars.map((b) => {
                    const taken = !!b.takenBy;
                    const selected = chosen === b.id;
                    return (
                      <tr key={b.id} className="border-t">
                        <td className="py-2 font-medium">{b.label}</td>
                        <td className="py-2 text-muted-foreground">
                          {taken ? b.takenBy : selected ? card.title || "This Smart Card" : "Empty"}
                        </td>
                        <td className="py-2 text-right">
                          {taken ? (
                            <span className="text-muted-foreground">In use</span>
                          ) : (
                            <Button
                              size="sm"
                              variant={selected ? "default" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => setChosen(b.id)}
                            >
                              {selected ? "Selected" : "Select"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!blocked && gameId && (
          <div className="rounded-xl border bg-card p-4">
            <Label className="text-xs">Pass mark</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={100}
                value={passPct}
                onChange={(e) => setPassPct(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                className="h-9 w-24 bg-muted tabular-nums"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <span className="ml-3 text-xs text-muted-foreground">
                Question total {totalMarks || "—"} marks · players must reach{" "}
                <span className="font-semibold text-foreground">{required}</span> marks to qualify.
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Every player fills their own progress bar — scores are never averaged, and the grand
              total is the question's own marks.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button disabled={!!blocked || !chosen || publishing} onClick={() => void publish()}>
            {publishing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Rocket className="mr-1 h-4 w-4" />}
            Publish Game Challenge
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SmartCardGameSetupPage;
