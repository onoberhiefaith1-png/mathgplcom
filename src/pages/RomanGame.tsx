import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { RomanInputPad } from "@/components/tally/RomanInputPad";
import { ObjectivesPanel } from "@/components/tally/ObjectivesPanel";
import { SettingsPanel } from "@/components/tally/SettingsPanel";
import { FlyingRewards } from "@/components/tally/FlyingRewards";
import { SPEED_OPTIONS } from "@/data/tallyAssets";
import { useTallyGame } from "@/hooks/useTallyGame";
import SeamlessBackground from "@/components/SeamlessBackground";
import { parseRoman, toRoman } from "@/lib/roman";
import { supabase } from "@/integrations/supabase/client";

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTIES: { id: Difficulty; label: string; range: [number, number]; desc: string }[] = [
  { id: "easy", label: "Easy", range: [1, 20], desc: "1 – 20" },
  { id: "medium", label: "Medium", range: [1, 100], desc: "1 – 100" },
  { id: "hard", label: "Hard", range: [1, 2000], desc: "1 – 2000" },
];

const BACK_PATH = "/levels/1";

const RomanGame = () => {
  const navigate = useNavigate();
  const game = useTallyGame();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [walletCoins, setWalletCoins] = useState<number>(() => Number(localStorage.getItem("tally_coins") || 0));
  const [userId, setUserId] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [invalidMsg, setInvalidMsg] = useState<string | null>(null);
  const [roman, setRoman] = useState("");
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

  // Stable refs so keypad callbacks never change identity (prevents re-renders during game loop)
  const romanRef = useRef("");
  romanRef.current = roman;
  const submitValueRef = useRef(game.submitValue);
  submitValueRef.current = game.submitValue;

  const flashShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 350);
  }, []);

  const handleAppend = useCallback((sym: string) => {
    setInvalidMsg(null);
    setRoman((r) => r + sym);
  }, []);
  const handleUndo = useCallback(() => {
    setInvalidMsg(null);
    setRoman((r) => r.slice(0, -1));
  }, []);
  const handleClear = useCallback(() => {
    setInvalidMsg(null);
    setRoman("");
  }, []);
  const handleSubmit = useCallback(() => {
    const current = romanRef.current;
    if (!current) return;
    const value = parseRoman(current);
    if (value == null) {
      setInvalidMsg(`"${current}" is not a valid Roman numeral`);
      flashShake();
      return;
    }
    const ok = submitValueRef.current(value);
    if (!ok) {
      setInvalidMsg(`${current} = ${value} — no matching number on board`);
      flashShake();
      return;
    }
    setInvalidMsg(null);
    setRoman("");
  }, [flashShake]);

  const startWithDifficulty = (d: Difficulty) => {
    const def = DIFFICULTIES.find((x) => x.id === d)!;
    game.setDifficulty(def.range[0], def.range[1]);
    setDifficulty(d);
  };

  const speedLabel =
    SPEED_OPTIONS.find((o) => o.seconds === game.settings.durationSec)?.label ??
    `${game.settings.durationSec}s`;

  const previewValue = parseRoman(roman);

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <SeamlessBackground file="obsidian.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/70" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Link to={BACK_PATH} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-xl font-black tracking-tight md:text-2xl">Roman Numerals</h1>
          <SettingsPanel settings={game.settings} onChange={game.updateSettings} />
        </div>

        {!userId && (
          <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-center text-xs">
            <Link to="/auth" className="font-semibold text-primary underline">Sign in</Link>{" "}
            to save your coins across sessions.
          </div>
        )}

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

        <div
          className={`flex flex-col gap-3 rounded-lg border bg-card/60 p-3 backdrop-blur ${shake ? "animate-pulse border-destructive" : ""}`}
        >
          <div className="flex min-h-14 items-center justify-between gap-3 rounded-md border bg-background/40 px-4 py-2">
            <div className="flex flex-1 items-center justify-center overflow-x-auto">
              <span className="font-mono text-3xl font-black tracking-[0.25em] text-primary">
                {roman || <span className="text-muted-foreground/60">—</span>}
              </span>
            </div>
            <span className="shrink-0 text-2xl font-black tabular-nums text-primary">
              {previewValue ?? (roman ? "?" : 0)}
            </span>
          </div>
          {invalidMsg && (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-1 text-center text-xs text-destructive">
              {invalidMsg}
            </div>
          )}
          <div className="flex items-center justify-center">
            <RomanInputPad
              onAppend={handleAppend}
              onUndo={handleUndo}
              onClear={handleClear}
              onSubmit={handleSubmit}
              disabled={game.status !== "playing" || !difficulty}
            />
          </div>
        </div>
      </div>

      <Dialog
        open={!difficulty}
        onOpenChange={(open) => {
          if (!open && !difficulty) navigate(BACK_PATH);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Difficulty</DialogTitle>
            <DialogDescription>Pick a level to start playing Roman Numerals.</DialogDescription>
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
                <span className="text-xs text-muted-foreground">
                  {d.desc} · highest: {toRoman(d.range[1])}
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={game.status === "gameover"}
        onOpenChange={(open) => {
          if (!open) navigate(BACK_PATH);
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
            <Button onClick={() => { setRoman(""); game.restart(); }}>Play Again</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={game.status === "levelcomplete"}
        onOpenChange={(open) => {
          if (!open) navigate(BACK_PATH);
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
            <Button onClick={() => { setRoman(""); game.nextLevel(); }}>Next Level</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RomanGame;
