import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameBoard } from "@/components/tally/GameBoard";
import { Hud } from "@/components/tally/Hud";
import { InputPad } from "@/components/tally/InputPad";
import { ObjectivesPanel } from "@/components/tally/ObjectivesPanel";
import { SettingsPanel } from "@/components/tally/SettingsPanel";
import { TallyDisplay } from "@/components/tally/TallyDisplay";
import { FlyingRewards } from "@/components/tally/FlyingRewards";
import { SPEED_OPTIONS } from "@/data/tallyAssets";
import { useTallyGame } from "@/hooks/useTallyGame";
import SeamlessBackground from "@/components/SeamlessBackground";
import { supabase } from "@/integrations/supabase/client";

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTIES: { id: Difficulty; label: string; range: [number, number]; desc: string }[] = [
  { id: "easy", label: "Easy", range: [1, 10], desc: "Maximum 10" },
  { id: "medium", label: "Medium", range: [1, 30], desc: "Maximum 30" },
  { id: "hard", label: "Hard", range: [1, 60], desc: "Maximum 60" },
];

const TallyGame = () => {
  const navigate = useNavigate();
  const game = useTallyGame();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [walletCoins, setWalletCoins] = useState<number>(() => Number(localStorage.getItem("tally_coins") || 0));
  const [userId, setUserId] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const lastSyncedRef = useRef(walletCoins);
  const walletRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const registerTile = useCallback((row: number, col: number, el: HTMLDivElement | null) => {
    const key = `${row}:${col}`;
    if (el) tileRefs.current.set(key, el);
    else tileRefs.current.delete(key);
  }, []);
  const getSourceRect = useCallback(
    (r: number, c: number) => tileRefs.current.get(`${r}:${c}`)?.getBoundingClientRect() ?? null,
    [],
  );
  const getWalletRect = useCallback(() => walletRef.current?.getBoundingClientRect() ?? null, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        supabase
          .from("player_stats")
          .select("coins")
          .eq("user_id", uid)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.coins != null) setWalletCoins(data.coins);
          });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const earnedRef = useRef(0);
  useEffect(() => {
    const delta = game.coinsEarned - earnedRef.current;
    if (delta > 0) setWalletCoins((c) => c + delta);
    earnedRef.current = game.coinsEarned;
  }, [game.coinsEarned]);

  useEffect(() => {
    localStorage.setItem("tally_coins", String(walletCoins));
    if (!userId) return;
    if (walletCoins === lastSyncedRef.current) return;
    const t = setTimeout(() => {
      supabase
        .from("player_stats")
        .upsert({ user_id: userId, coins: walletCoins, updated_at: new Date().toISOString() })
        .then(() => {
          lastSyncedRef.current = walletCoins;
        });
    }, 1500);
    return () => clearTimeout(t);
  }, [walletCoins, userId]);

  const handleSubmit = () => {
    const ok = game.submit();
    if (!ok && game.tally > 0) {
      setShake(true);
      setTimeout(() => setShake(false), 350);
    }
  };

  const startWithDifficulty = (d: Difficulty) => {
    const def = DIFFICULTIES.find((x) => x.id === d)!;
    game.setDifficulty(def.range[0], def.range[1]);
    setDifficulty(d);
  };

  const speedLabel =
    SPEED_OPTIONS.find((o) => o.seconds === game.settings.durationSec)?.label ??
    `${game.settings.durationSec}s`;

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <SeamlessBackground file="obsidian.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/70" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-3 p-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <Link to="/subjects/algebra/numbers-and-numerals" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-xl font-black tracking-tight md:text-2xl">Tally Marks</h1>
          <SettingsPanel settings={game.settings} onChange={game.updateSettings} />
        </div>

        {!userId && (
          <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-center text-xs">
            <Link to="/auth" className="font-semibold text-primary underline">Sign in</Link>{" "}
            to save your coins across sessions.
          </div>
        )}

        {/* Combined HUD: stats + objectives */}
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="flex-1 min-w-[280px]">
            <Hud
              ref={walletRef}
              level={game.level}
              score={game.score}
              misses={game.misses}
              missLimit={game.settings.missLimit}
              coins={walletCoins}
              speedLabel={speedLabel}
            />
          </div>
          <div className="w-full md:w-auto md:min-w-[280px]">
            <ObjectivesPanel objectives={game.objectives} />
          </div>
        </div>

        {/* Game board fills space */}
        <div className="flex-1">
          <GameBoard
            tiles={game.tiles}
            revealed={game.revealed}
            active={game.active}
            blasts={game.blasts}
            durationSec={game.settings.durationSec}
            registerTile={registerTile}
          />
        </div>

        <FlyingRewards
          events={game.collectEvents}
          getSourceRect={getSourceRect}
          getWalletRect={getWalletRect}
        />

        {/* Bottom: tally display + input pad */}
        <div
          className={`flex flex-col gap-3 rounded-lg border bg-card/60 p-3 backdrop-blur ${shake ? "animate-pulse border-destructive" : ""}`}
        >
          <div className="flex min-h-14 items-center justify-between gap-3 rounded-md border bg-background/40 px-4 py-2">
            <div className="flex flex-1 items-center justify-center overflow-x-auto">
              <TallyDisplay value={game.tally} />
            </div>
            <span className="shrink-0 text-2xl font-black tabular-nums text-primary">{game.tally}</span>
          </div>
          <div className="flex items-center justify-center">
            <InputPad
              onAddOne={game.addOne}
              onAddFive={game.addFive}
              onUndo={game.undo}
              onClear={game.clear}
              onSubmit={handleSubmit}
              disabled={game.status !== "playing" || !difficulty}
            />
          </div>
        </div>
      </div>

      {/* Difficulty selector — shown until chosen */}
      <Dialog
        open={!difficulty}
        onOpenChange={(open) => {
          if (!open && !difficulty) navigate("/subjects/algebra/numbers-and-numerals");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Difficulty</DialogTitle>
            <DialogDescription>Pick a level to start playing Tally Marks.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {DIFFICULTIES.map((d) => (
              <Button
                key={d.id}
                variant="outline"
                className="h-auto justify-between py-4"
                onClick={() => startWithDifficulty(d.id)}
              >
                <span className="font-bold">{d.label}</span>
                <span className="text-xs text-muted-foreground">{d.desc}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={game.status === "gameover"}
        onOpenChange={(open) => {
          if (!open) navigate("/subjects/algebra/numbers-and-numerals");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Game Over</DialogTitle>
            <DialogDescription>
              Final score: <strong>{game.score}</strong> · Coins earned: <strong>{game.coinsEarned}</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={game.restart}>Play Again</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={game.status === "levelcomplete"}
        onOpenChange={(open) => {
          if (!open) navigate("/subjects/algebra/numbers-and-numerals");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Level {game.level} Complete!</DialogTitle>
            <DialogDescription>
              Score: <strong>{game.score}</strong>
              {game.sweptCoins > 0 && (
                <> · Swept <strong className="text-primary">+{game.sweptCoins} coins</strong> from the board!</>
              )}
              <br />Ready for the next round?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={game.nextLevel}>Next Level</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TallyGame;
