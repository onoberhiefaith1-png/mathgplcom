import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const WorldStage = lazy(() => import("@/components/gameslate/world/WorldStage"));
import { ControlPanel } from "@/components/slate/ControlPanel";
import { QuestionsPanel } from "@/components/slate/QuestionsPanel";
import { previewSlots, type PreviewLine } from "@/lib/slate/lineSurfaces";
import { rewardsForLine } from "@/lib/slate/pattern";
import { RewardStatusBar } from "@/components/slate/RewardStatusBar";
import { getReward } from "@/lib/slate/rewards";
import { getSurface } from "@/lib/slate/surfaces";
import { loadGame, saveGame, saveGameResult } from "@/lib/slate/storage";
import { makeSlot, uid } from "@/lib/slate/defaults";
import { isMuted, setMuted } from "@/lib/slate/audio";
import { applyMute, playTrack, stopTrack } from "@/lib/slate/music";
import type { EditorMode, Game, Selection, Slot } from "@/lib/slate/types";


export default function GameSlateEditorPage() {
  const { gameId } = useParams({ from: "/game/slate/$gameId/" });
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [mode, setMode] = useState<EditorMode>("edit");
  const [panelOpen, setPanelOpen] = useState(true);
  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  /** Attached-exercise preview: the question's real lines on this material. */
  const [previewLines, setPreviewLines] = useState<PreviewLine[] | null>(null);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => setMutedState(isMuted()), []);

  // background music: the room's own track wins, otherwise the chosen one
  const assets = game?.settings.assets;
  const roomTrackId = assets?.roomTrackIds?.[game?.roomId ?? ""] ?? null;
  const trackId = roomTrackId ?? assets?.activeTrackId ?? null;
  const track = assets?.audio.find((item) => item.id === trackId) ?? null;

  useEffect(() => {
    if (!track) {
      stopTrack();
      return;
    }
    void playTrack(track.assetId, { volume: track.volume, loop: track.loop });
  }, [track?.assetId, track?.volume, track?.loop]);

  useEffect(() => () => stopTrack(), []);

  useEffect(() => {
    let cancelled = false;
    loadGame(gameId).then((g) => {
      if (cancelled) return;
      if (!g) {
        toast.error("That game could not be found in your account.");
        navigate({ to: "/game" });
        return;
      }
      setGame(g);
      loadedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, navigate]);

  const patchGame = useCallback(
    (patch: Partial<Game>) => setGame((g) => (g ? { ...g, ...patch } : g)),
    [],
  );

  const patchSlot = useCallback((slotId: string, patch: Partial<Slot>) => {
    setGame((g) =>
      g
        ? { ...g, slots: g.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)) }
        : g,
    );
  }, []);

  const moveReward = useCallback(
    (slotId: string, rewardId: string, x: number, y: number) => {
      setGame((g) =>
        g
          ? {
              ...g,
              slots: g.slots.map((s) =>
                s.id === slotId
                  ? {
                      ...s,
                      rewards: s.rewards.map((r) => (r.id === rewardId ? { ...r, x, y } : r)),
                    }
                  : s,
              ),
            }
          : g,
      );
    },
    [],
  );

  const activateReward = useCallback((slotId: string, rewardId: string, type: string) => {
    setGame((current) => {
      if (!current) return current;
      const reward = current.slots
        .find((slot) => slot.id === slotId)
        ?.rewards.find((item) => item.id === rewardId);
      if (!reward || reward.state !== "dormant") return current;

      const status = { ...current.status };
      if (type === "math-vault") status.vaultsOpened += 1;
      if (type === "retry-heart") status.lives += 1;
      if (type === "time-shard") {
        // the hourglass gives exactly the time the teacher stored in it
        const bonus = Math.max(1000, reward.durationMs ?? 15_000);
        const base =
          status.timerEndsAt && status.timerEndsAt > Date.now() ? status.timerEndsAt : Date.now();
        status.timerEndsAt = base + bonus;
      }

      const next = {
        ...current,
        status,
        slots: current.slots.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                rewards: slot.rewards.map((item) =>
                  item.id === rewardId ? { ...item, state: "active" as const } : item,
                ),
              }
            : slot,
        ),
      };
      saveGame(next);
      return next;
    });
  }, []);

  const consumeReward = useCallback((slotId: string, rewardId: string) => {
    setGame((current) => {
      if (!current) return current;
      const next = {
        ...current,
        slots: current.slots.map((slot) =>
          slot.id === slotId
            ? { ...slot, rewards: slot.rewards.filter((reward) => reward.id !== rewardId) }
            : slot,
        ),
      };
      saveGame(next);
      return next;
    });
  }, []);

  // Every teacher change is account-backed. Navigation, refresh, or opening
  // Play can no longer discard a surface change made since the last button save.
  useEffect(() => {
    if (!game || !loadedRef.current) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      setSaving(true);
      const result = await saveGameResult(game);
      setSaving(false);
      if (!result.ok) toast.error(result.message ?? "Your latest Game change could not be saved.");
    }, 900);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [game]);

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!saving) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [saving]);

  if (!game) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0906] text-sm text-amber-100/70">
      Loading your Game…
    </div>
  );


  const surface = getSurface(game.surfaceId);
  const editing = mode === "edit";
  const vaultsTotal =
    game.status.vaultsOpened +
    game.slots.reduce(
      (total, slot) =>
        total + slot.rewards.filter((reward) => reward.type === "math-vault").length,
      0,
    );


  const addReward = (typeId: string) => {
    const slotId = selection.kind !== "none" ? selection.slotId : game.slots[0]?.id;
    if (!slotId) return;
    const slot = game.slots.find((s) => s.id === slotId);
    if (!slot) return;
    const n = slot.rewards.length;
    patchSlot(slotId, {
      rewards: [
        ...slot.rewards,
        { id: uid(), type: typeId, state: "dormant", hidden: false, x: 90 - n * 10, y: 76, z: 0, scale: 1, rotation: 0, lighting: 1, animation: 1, effectIntensity: 1, material: "metal", colour: "natural", relief: "raised" },
      ],
    });
    toast.success(`${getReward(typeId).label} placed on slot ${game.slots.indexOf(slot) + 1}`);
  };


  const save = async () => {
    if (!game || saving) return;
    setSaving(true);
    try {
      const result = await saveGameResult(game);
      if (result.ok) {
        toast.success("Game saved to your account.");
      } else {
        toast.error(result.message ?? "The game could not be saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  // preview never touches the saved game
  const stageGame =
    previewLines && previewLines.length > 0
      ? { ...game, slots: previewSlots(game, previewLines, (line) => rewardsForLine(game, line)) }
      : game;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0b0906] text-amber-50">
      {/* LEFT — the live 3D world */}
      <div className="relative min-w-0 flex-1">
        <ClientOnly fallback={<div className="absolute inset-0 bg-[#0b0906]" />}>
          <Suspense fallback={<div className="absolute inset-0 bg-[#0b0906]" />}>
            <WorldStage
              game={stageGame}
              mode={mode}
              selection={selection}
              onSelect={setSelection}
              onSlotChange={patchSlot}
              onRewardMove={moveReward}
              onRewardActivate={activateReward}
              onRewardConsume={consumeReward}
            />
          </Suspense>
        </ClientOnly>

        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 py-3 sm:gap-3 sm:px-5">
          <div className="pointer-events-auto flex min-w-0 items-baseline gap-3">
            <Link
              to="/game"
              className="shrink-0 text-xs uppercase tracking-[0.2em] text-amber-200/50 hover:text-amber-200"
            >
              ← Games
            </Link>
            <h1 className="hidden truncate text-lg font-semibold tracking-wide sm:block">{game.name}</h1>
            <span className="hidden truncate text-xs uppercase tracking-[0.18em] text-amber-200/50 lg:block">
              {[game.topic, game.subtopic].filter(Boolean).join(" · ")}
            </span>
          </div>
          <RewardStatusBar status={game.status} vaultsTotal={vaultsTotal} />
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => {
                const next = !muted;
                setMutedState(next);
                setMuted(next);
                applyMute(next, track?.volume ?? 0.6);
              }}
              aria-label={muted ? "Turn sound on" : "Turn sound off"}
              className="rounded border border-amber-200/20 px-2 py-1.5 text-xs text-amber-100/70 hover:bg-amber-200/10"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button
              onClick={() => {
                setMode("view");
                setSelection({ kind: "none" });
                setPanelOpen(false);
              }}
              className={`rounded border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition ${
                mode === "view"
                  ? "border-amber-300 bg-amber-300/15 text-amber-100"
                  : "border-amber-200/20 text-amber-100/60 hover:bg-amber-200/10"
              }`}
            >
              View
            </button>
            <button
              onClick={() => {
                setQuestionsOpen((open) => !open);
                setPanelOpen(false);
              }}
              className={`rounded border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition ${
                questionsOpen
                  ? "border-amber-300 bg-amber-300/15 text-amber-100"
                  : "border-amber-200/20 text-amber-100/60 hover:bg-amber-200/10"
              }`}
            >
              Questions
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded border border-amber-200/20 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-amber-100/70 hover:bg-amber-200/10 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {/* Same runtime students get; nothing is recorded for the teacher. */}
            <Link
              to="/game/play/$gameId"
              params={{ gameId: game.id }}
              className="rounded border border-emerald-300/40 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-emerald-100/80 hover:bg-emerald-300/10"
            >
              Play
            </Link>
            <button
              onClick={() => {
                if (mode === "edit" && panelOpen) {
                  setPanelOpen(false);
                  return;
                }
                setMode("edit");
                setPanelOpen(true);
              }}
              className={`rounded border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition ${
                mode === "edit" && panelOpen
                  ? "border-amber-300 bg-amber-300/15 text-amber-100"
                  : "border-amber-200/20 text-amber-100/60 hover:bg-amber-200/10"
              }`}
            >
              Edit
            </button>
          </div>
        </header>

        {previewLines ? (
          <button
            onClick={() => setPreviewLines(null)}
            className="absolute inset-x-0 bottom-4 z-20 mx-auto w-fit rounded border border-amber-300/40 bg-black/70 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-amber-100"
          >
            Showing the question's lines · exit preview
          </button>
        ) : null}

        {!editing && !previewLines ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 z-20 text-center text-[11px] uppercase tracking-[0.22em] text-amber-100/40">
            Click a section and write · {surface.label}
          </p>
        ) : null}
      </div>

      {/* RIGHT — the one control room, a real 20% column (slide-over on phones) */}
      {questionsOpen ? (
        <div className="fixed inset-y-0 right-0 z-30 w-[86vw] max-w-[420px] md:static md:w-[24%] md:min-w-[300px] md:max-w-[440px] md:shrink-0">
          <QuestionsPanel
            game={game}
            onChange={(settings) => patchGame({ settings })}
            onPreview={setPreviewLines}
            onClose={() => setQuestionsOpen(false)}
          />
        </div>
      ) : null}

      {panelOpen ? (
        <div className="fixed inset-y-0 right-0 z-30 w-[86vw] max-w-[420px] md:static md:w-[20%] md:min-w-[280px] md:max-w-[420px] md:shrink-0">
          <ControlPanel
            game={game}
            selection={selection}
            onSelect={setSelection}
            onChange={patchGame}
            onSlotChange={patchSlot}
            onAddReward={addReward}
            onClose={() => setPanelOpen(false)}
            onSave={save}
          />
        </div>
      ) : null}
    </div>
  );
}
