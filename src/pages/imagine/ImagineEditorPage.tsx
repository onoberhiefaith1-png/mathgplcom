import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Play, Save, Settings2, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import ImagineStage from "@/components/imagine/ImagineStage";
import { QuestionsPanel } from "@/components/slate/QuestionsPanel";
import { SoundPicker } from "@/components/slate/SoundPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { makeSlot } from "@/lib/slate/defaults";
import { isMuted, setMuted } from "@/lib/slate/audio";
import { applyMute, playTrack, stopTrack } from "@/lib/slate/music";
import { IMAGINE_REWARDS, PLACEABLE_REWARDS, getReward } from "@/lib/slate/rewards";
import { REWARD_SOUND_KEYS, REWARD_SOUND_LABEL } from "@/lib/slate/sound";
import { previewSlots, type PreviewLine } from "@/lib/slate/lineSurfaces";
import { rewardsForLine } from "@/lib/slate/pattern";
import { loadGame, saveGameResult } from "@/lib/slate/storage";
import { SURFACES } from "@/lib/slate/surfaces";
import type { Game, Selection, Slot } from "@/lib/slate/types";
import {
  imagineSavedSize,
  imagineSizeToSlider,
  imagineSliderToSize,
  type ImagineViewport,
} from "@/lib/imagine/responsiveSize";
import { isImagineRewardChoice, normalizeImagineGame } from "@/lib/imagine/rewards";

export default function ImagineEditorPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  const [previewLines, setPreviewLines] = useState<PreviewLine[] | null>(null);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [textSizeViewport, setTextSizeViewport] = useState<ImagineViewport>();
  const latestGame = useRef(game);
  latestGame.current = game;
  const dirty = useRef(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void loadGame(gameId).then((value) => {
      if (!active) return;
      if (!value) {
        toast.error("That Game could not be found.");
        navigate({ to: "/game" });
        return;
      }
      setGame(normalizeImagineGame(value));
    });
    setMutedState(isMuted());
    return () => { active = false; };
  }, [gameId, navigate]);

  const patchGame = useCallback((patch: Partial<Game>) => {
    dirty.current = true;
    setGame((current) => current ? { ...current, ...patch } : current);
  }, []);

  const patchSlot = useCallback((slotId: string, patch: Partial<Slot>) => {
    dirty.current = true;
    setGame((current) => current ? {
      ...current,
      slots: current.slots.map((slot) => slot.id === slotId ? { ...slot, ...patch } : slot),
    } : current);
  }, []);

  useEffect(() => {
    if (!game || !dirty.current) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const result = await saveGameResult(game);
      if (result.ok && latestGame.current === game) dirty.current = false;
    }, 900);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [game]);

  const assets = game?.settings.assets;
  const track = assets?.audio.find((item) => item.id === assets.activeTrackId) ?? null;
  useEffect(() => {
    if (!track) { stopTrack(); return; }
    void playTrack(track.assetId, { volume: track.volume, loop: track.loop });
    return () => stopTrack();
  }, [track?.assetId, track?.loop, track?.volume]);

  if (!game) return <div className="grid h-[100dvh] place-items-center bg-background text-muted-foreground">Opening Game…</div>;

  const selectedSlotId = selection.kind === "none" ? game.slots[0]?.id : selection.slotId;
  const selectedSlot = game.slots.find((slot) => slot.id === selectedSlotId) ?? game.slots[0] ?? null;
  const stageGame = previewLines?.length
    ? { ...game, slots: previewSlots(game, previewLines, (line) => rewardsForLine(game, line)) }
    : game;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const result = await saveGameResult(game);
    setSaving(false);
    if (result.ok) {
      if (latestGame.current === game) dirty.current = false;
      toast.success("Game saved.");
    } else toast.error(result.message ?? "Game could not be saved.");
  };

  const resizeSlots = (count: number) => {
    const safe = Math.max(1, Math.min(50, count));
    const slots = game.slots.slice(0, safe);
    while (slots.length < safe) slots.push(makeSlot(slots.length));
    patchGame({ slots, patternLength: safe });
  };

  const uploadBackground = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => patchGame({
      background: {
        ...game.background,
        src: String(reader.result),
        assetId: null,
        kind: file.type.startsWith("video") ? "video" : "image",
      },
    });
    reader.readAsDataURL(file);
  };

  const addReward = (type: string): string | null => {
    if (!selectedSlot) return null;
    const id = crypto.randomUUID();
    patchSlot(selectedSlot.id, {
      rewards: [...selectedSlot.rewards, {
        id, type, state: "dormant", hidden: false,
        x: 88, y: 20 + selectedSlot.rewards.length * 12,
      }],
    });
    return id;
  };

  const previewReward = (type: string) => {
    if (!selectedSlot) return;
    const reward = selectedSlot.rewards.find((item) => item.type === type);
    if (!reward) {
      const id = addReward(type);
      window.setTimeout(() => {
        if (id) window.dispatchEvent(new CustomEvent("slate:activate-reward", { detail: { slotId: selectedSlot.id, rewardId: id, preview: true } }));
      }, 60);
      return;
    }
    window.dispatchEvent(new CustomEvent("slate:activate-reward", { detail: { slotId: selectedSlot.id, rewardId: reward.id, preview: true } }));
  };

  const patchSettings = (patch: Partial<Game["settings"]>) =>
    patchGame({ settings: { ...game.settings, ...patch } });

  const patchImagine = (patch: Partial<NonNullable<Game["settings"]["imagine"]>>) =>
    patchSettings({ imagine: { ...game.settings.imagine, ...patch } as NonNullable<Game["settings"]["imagine"]> });

  const deviceTextSize = (viewport: ImagineViewport) => {
    const fallback = viewport === "desktop"
      ? game.settings.text.desktopSize
      : viewport === "tablet"
        ? game.settings.text.tabletSize
        : game.settings.text.mobileSize;
    return imagineSavedSize(game.settings.imagine, viewport, fallback ?? game.settings.text.size);
  };

  const patchDeviceTextSize = (viewport: ImagineViewport, position: number) => {
    const value = imagineSliderToSize(position, viewport);
    setTextSizeViewport(viewport);
    dirty.current = true;
    setGame((current) => current ? {
      ...current,
      settings: {
        ...current.settings,
        imagine: {
          sensorVisible: true,
          growWithContent: true,
          finish: "framed",
          textTreatment: "raised",
          ...current.settings.imagine,
          ...(viewport === "desktop" ? { desktopTextSize: value }
            : viewport === "tablet" ? { tabletTextSize: value } : { mobileTextSize: value }),
        },
      },
    } : current);
  };

  const patchText = (patch: Partial<Game["settings"]["text"]>) => {
    const text = { ...game.settings.text, ...patch };
    dirty.current = true;
    setGame((current) => current ? {
      ...current,
      settings: { ...current.settings, text },
      slots: current.slots.map((slot) => ({
        ...slot,
        textConfig: slot.textConfig ? { ...slot.textConfig, ...patch } : slot.textConfig,
      })),
    } : current);
  };

  return (
    <main className="flex h-[100dvh] min-w-0 overflow-hidden bg-background text-foreground">
      <section className="relative min-w-0 flex-1">
        <ImagineStage
          game={stageGame}
          selection={selection}
          onSelect={setSelection}
          focusSlotId={selectedSlotId}
          textSizeViewport={textSizeViewport}
        />
        <header className="absolute inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b border-border/60 bg-background/90 px-3 backdrop-blur">
          <Button asChild variant="ghost" size="sm"><Link to="/game">Games</Link></Button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{game.name}</h1>
          <Button variant="outline" size="icon-sm" className="lg:hidden" onClick={() => setSettingsOpen(true)} aria-label="Game settings"><Settings2 /></Button>
          <Button variant="outline" size="sm" onClick={() => setQuestionsOpen((open) => !open)}>Questions</Button>
          <Button variant="outline" size="icon-sm" onClick={() => {
            const next = !muted;
            setMutedState(next);
            setMuted(next);
            applyMute(next, track?.volume ?? 0.6);
          }} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
          <Button variant="outline" size="icon-sm" disabled={saving} onClick={() => void save()} aria-label="Save Game"><Save /></Button>
          <Button asChild size="sm"><Link to="/game/play/$gameId" params={{ gameId }}><Play /> Play</Link></Button>
        </header>
      </section>

      <aside className={`${settingsOpen ? "flex" : "hidden"} fixed inset-y-0 right-0 z-40 w-[min(92vw,360px)] shrink-0 flex-col overflow-y-auto border-l border-border bg-card p-4 shadow-xl lg:static lg:flex lg:w-[320px] lg:shadow-none`}>
        <div className="mb-5 flex items-center gap-2"><Settings2 className="h-4 w-4" /><h2 className="flex-1 font-semibold">Game settings</h2><Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X /></Button></div>
        <div className="space-y-5">
          <div className="space-y-2"><Label htmlFor="imagine-name">Name</Label><Input id="imagine-name" value={game.name} onChange={(event) => patchGame({ name: event.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label htmlFor="imagine-topic">Topic</Label><Input id="imagine-topic" value={game.topic} onChange={(event) => patchGame({ topic: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="imagine-subtopic">Subtopic</Label><Input id="imagine-subtopic" value={game.subtopic} onChange={(event) => patchGame({ subtopic: event.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Background</Label>
            <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background text-sm hover:bg-accent">
              <ImagePlus className="h-4 w-4" /> Choose picture or video
              <input className="sr-only" type="file" accept="image/*,video/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadBackground(file); }} />
            </label>
            <Label>Background opacity</Label>
            <Slider value={[game.background.opacity]} min={0.2} max={1} step={0.05} onValueChange={([value]) => patchGame({ background: { ...game.background, opacity: value ?? 1 } })} />
          </div>
          <div className="space-y-2"><Label>Writing surface</Label><div className="grid grid-cols-2 gap-2">{SURFACES.map((surface) => (
            <Button key={surface.id} variant={surface.id === game.surfaceId ? "default" : "outline"} size="sm" className="h-auto min-h-9 whitespace-normal" onClick={() => patchGame({ surfaceId: surface.id })}>{surface.label}</Button>
          ))}</div></div>
          <div className="space-y-2">
            <Label>Surface finish</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["clean", "framed", "luminous"] as const).map((finish) => (
                <Button key={finish} type="button" variant={(game.settings.imagine?.finish ?? "framed") === finish ? "default" : "outline"} size="sm" className="capitalize" onClick={() => patchImagine({ finish })}>{finish}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-2"><Label>Writing style</Label><div className="grid grid-cols-3 gap-2">{(["flat", "raised", "engraved"] as const).map((textTreatment) => <Button key={textTreatment} type="button" variant={(game.settings.imagine?.textTreatment ?? "raised") === textTreatment ? "default" : "outline"} size="sm" className="capitalize" onClick={() => patchImagine({ textTreatment })}>{textTreatment}</Button>)}</div></div>
          <div className="space-y-3">
            <Label>Text size</Label>
            {(["desktop", "tablet", "phone"] as const).map((viewport) => {
              const value = deviceTextSize(viewport);
              return <div key={viewport} className="space-y-2">
                <span className="text-xs capitalize text-muted-foreground">{viewport} · {value.toFixed(1)}px</span>
                <Slider min={0} max={100} step={0.5} value={[imagineSizeToSlider(value, viewport)]} onValueChange={([position]) => patchDeviceTextSize(viewport, position ?? 50)} aria-label={`${viewport} text size`} />
              </div>;
            })}
          </div>
          <div className="space-y-2"><Label htmlFor="imagine-text-colour">Text colour</Label><div className="flex items-center gap-3"><input id="imagine-text-colour" type="color" value={game.settings.text.colour ?? "#173f91"} onChange={(event) => patchText({ colour: event.target.value })} className="h-9 w-12 rounded border border-input bg-background p-1" /><Button type="button" variant="outline" size="sm" onClick={() => patchText({ colour: null })}>Surface ink</Button></div></div>
          <div className="space-y-2"><Label htmlFor="imagine-lines">Writing lines</Label><Input id="imagine-lines" type="number" min={1} max={50} value={game.slots.length} onChange={(event) => resizeSlots(Number(event.target.value) || 1)} /></div>
          <div className="flex items-center justify-between"><Label htmlFor="imagine-numbers">Line numbers</Label><Switch id="imagine-numbers" checked={game.settings.numbers.visible} onCheckedChange={(visible) => patchGame({ settings: { ...game.settings, numbers: { ...game.settings.numbers, visible } } })} /></div>
          <div className="flex items-center justify-between"><Label htmlFor="imagine-sensor">Writing sensor</Label><Switch id="imagine-sensor" checked={game.settings.imagine?.sensorVisible !== false} onCheckedChange={(sensorVisible) => patchImagine({ sensorVisible })} /></div>
          <div className="flex items-center justify-between"><Label htmlFor="imagine-growth">Grow with writing</Label><Switch id="imagine-growth" checked={game.settings.imagine?.growWithContent !== false} onCheckedChange={(growWithContent) => patchImagine({ growWithContent })} /></div>
          <div className="space-y-2"><Label>Rewards for selected line</Label><div className="grid grid-cols-2 gap-2">{[...PLACEABLE_REWARDS, ...IMAGINE_REWARDS].filter((reward) => isImagineRewardChoice(reward.id)).map((reward) => (
            <div key={reward.id} className="overflow-hidden rounded-md border border-border bg-background"><button type="button" className="flex min-h-20 w-full flex-col items-center justify-center gap-1 p-2 text-xs" onClick={() => addReward(reward.id)}><img src={getReward(reward.id).art} alt="" loading="lazy" width={816} height={816} className="h-10 w-10 object-contain" /><span>{reward.label}</span></button><Button type="button" variant="ghost" size="sm" className="w-full rounded-none border-t border-border" onClick={() => previewReward(reward.id)}><Play /> Preview</Button></div>
          ))}</div></div>
          <div className="space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between"><Label htmlFor="imagine-background-sound">Background sound</Label><Switch id="imagine-background-sound" checked={game.settings.sound.background.enabled} onCheckedChange={(enabled) => patchSettings({ sound: { ...game.settings.sound, background: { ...game.settings.sound.background, enabled } } })} /></div>
            <SoundPicker label="Game background sound" purpose="background" slot={game.settings.sound.background} onChange={(backgroundSound) => patchSettings({ sound: { ...game.settings.sound, background: { ...backgroundSound, enabled: game.settings.sound.background.enabled } } })} />
          </div>
          <div className="space-y-3 border-t border-border pt-5">
            <Label>Reward sounds</Label>
            {REWARD_SOUND_KEYS.map((key) => <SoundPicker key={key} label={REWARD_SOUND_LABEL[key]} purpose={key} slot={game.settings.sound.rewards[key]} onChange={(slot) => patchSettings({ sound: { ...game.settings.sound, rewards: { ...game.settings.sound.rewards, [key]: slot } } })} />)}
          </div>
        </div>
      </aside>

      {questionsOpen ? <div className="fixed inset-y-0 right-0 z-40 w-[min(92vw,420px)]"><QuestionsPanel game={game} onChange={(settings) => patchGame({ settings })} onPreview={setPreviewLines} onClose={() => setQuestionsOpen(false)} /></div> : null}
    </main>
  );
}