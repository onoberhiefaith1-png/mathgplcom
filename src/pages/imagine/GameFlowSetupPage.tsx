import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Pause, Play, Save, Trash2, Upload } from "lucide-react";
import { useNavigate, useParams } from "@/lib/router-compat";
import ClipProcessor from "@/components/flow/ClipProcessor";
import { GameCompletionScene } from "@/components/imagine/GameCompletionScene";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { probeTransparencyFromUrl } from "@/lib/flow/alpha";
import { createFlow, flowUrl, listFlows, loadFlow, saveFlow, uploadFlowClip, videoDuration } from "@/lib/flow/api";
import { locate, sceneLabel, totalDuration, withRanges } from "@/lib/flow/segments";
import type { FlowClip, FlowConfig } from "@/lib/flow/types";
import { defaultGameCompletionFlow } from "@/lib/imagine/gameCompletion";
import { loadGame, saveGameResult } from "@/lib/slate/storage";
import type { Game, GameCompletionMoment } from "@/lib/slate/types";

const MOMENTS: { id: GameCompletionMoment; label: string; note: string }[] = [
  { id: "complete", label: "Question Completed Successfully", note: "The student completes the question" },
  { id: "failed", label: "Question Failed", note: "Time ended with no life left" },
  { id: "left", label: "Game Exited Midway", note: "The student leaves before finishing" },
  { id: "perfect", label: "Perfect Run (optional)", note: "Uses Question Completed if empty" },
  { id: "victory", label: "Final Victory (optional)", note: "Uses Question Completed if empty" },
];

export default function GameFlowSetupPage() {
  const { gameId = "" } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clipIndex, setClipIndex] = useState(0);
  const [src, setSrc] = useState("");
  const [preview, setPreview] = useState<GameCompletionMoment>("complete");
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [shared, setShared] = useState<FlowConfig[]>([]);
  useEffect(() => { void loadGame(gameId).then(setGame); void listFlows().then(setShared); }, [gameId]);
  const flow = game?.settings.completionFlow ?? defaultGameCompletionFlow();
  const duration = totalDuration(flow.clips);
  useEffect(() => {
    const clip = flow.clips[clipIndex];
    if (!clip) { setSrc(""); return; }
    void flowUrl(clip.path).then((url) => setSrc(url ?? ""));
  }, [flow.clips, clipIndex]);
  const offset = useMemo(() => flow.clips.slice(0, clipIndex).reduce((sum, clip) => sum + clip.duration, 0), [flow.clips, clipIndex]);

  const patchFlow = (patch: Partial<typeof flow>) => setGame((current) => current ? ({ ...current, settings: { ...current.settings, completionFlow: { ...flow, ...patch } } }) : current);
  const patchClip = (id: string, patch: Partial<FlowClip>) => patchFlow({ clips: flow.clips.map((clip) => clip.id === id ? { ...clip, ...patch } : clip) });
  const seek = (next: number) => {
    const located = locate(flow.clips, next);
    setTime(next);
    if (located.index !== clipIndex) { pendingSeek.current = located.local; setClipIndex(located.index); }
    else if (videoRef.current) videoRef.current.currentTime = located.local;
  };
  const setMomentStart = (id: GameCompletionMoment) => {
    const old = flow.moments[id];
    patchFlow({ moments: { ...flow.moments, [id]: { start: time, end: Math.max(time + 0.1, old?.end ?? Math.min(duration, time + 2)) } } });
  };
  const setMomentEnd = (id: GameCompletionMoment) => {
    const old = flow.moments[id];
    patchFlow({ moments: { ...flow.moments, [id]: { start: Math.min(old?.start ?? 0, time - 0.1), end: time } } });
  };
  const linked = shared.find((item) => item.id === flow.flowId) ?? null;
  const ranges = useMemo(() => linked ? withRanges(linked.scenes) : [], [linked]);
  useEffect(() => {
    if (!linked || flow.baseScene) return;
    const base = withRanges(linked.scenes).find((scene) => scene.type === "base");
    if (!base) return;
    patchFlow({ baseScene: { start: base.start, end: base.end } });
  }, [linked?.id, flow.baseScene?.start, flow.baseScene?.end]);
  const applyShared = (cfg: FlowConfig | null) => {
    if (!cfg) { patchFlow({ flowId: null }); return; }
    const r = withRanges(cfg.scenes);
    const base = r.find((scene) => scene.type === "base") ?? null;
    const pick = (id?: string | null) => { const hit = r.find((x) => x.id === id); return hit ? { start: hit.start, end: hit.end } : null; };
    const sceneIds = flow.sceneIds ?? {};
    patchFlow({
      flowId: cfg.id, clips: cfg.clips, enabled: true, emojiKeys: true, sceneIds,
      baseScene: base ? { start: base.start, end: base.end } : null,
      moments: Object.fromEntries(MOMENTS.map((m) => [m.id, pick(sceneIds[m.id]) ?? (sceneIds[m.id] === undefined ? flow.moments[m.id] : null)])) as typeof flow.moments,
      emojis: r.filter((x) => x.type === "emotion").map((x) => ({ id: x.id, label: sceneLabel(x), start: x.start, end: x.end })),
    });
  };
  const assignScene = (moment: GameCompletionMoment, sceneId: string) => {
    const hit = ranges.find((x) => x.id === sceneId) ?? null;
    patchFlow({ sceneIds: { ...(flow.sceneIds ?? {}), [moment]: hit?.id ?? null }, moments: { ...flow.moments, [moment]: hit ? { start: hit.start, end: hit.end } : null } });
  };
  const upload = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    try {
      // New videos go into a shared Flow so Lesson Notes can use them too.
      let target = linked ?? (flow.flowId ? await loadFlow(flow.flowId) : null);
      if (!target) target = await createFlow(`${game?.name ?? "Game"} Flow`);
      const added: FlowClip[] = [];
      for (const file of Array.from(files)) {
        const [path, clipDuration] = await Promise.all([uploadFlowClip(target.id, file), videoDuration(file)]);
        const local = URL.createObjectURL(file);
        const transparency = await probeTransparencyFromUrl(local, path);
        URL.revokeObjectURL(local);
        added.push({ id: crypto.randomUUID(), path, name: file.name, duration: clipDuration, removeBg: false, transparency });
      }
      const nextClips = [...target.clips, ...added];
      await saveFlow({ ...target, clips: nextClips });
      const refreshed = { ...target, clips: nextClips };
      setShared((list) => [...list.filter((item) => item.id !== refreshed.id), refreshed]);
      patchFlow({ flowId: refreshed.id, clips: nextClips, enabled: true });
    } catch (error) { toast({ title: "Upload failed", description: (error as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!game) return;
    setBusy(true);
    const result = await saveGameResult(game);
    setBusy(false);
    if (result.ok) toast({ title: "Game Flow saved" });
    else toast({ title: "Save failed", description: result.message, variant: "destructive" });
  };
  if (!game) return <div className="grid h-[100dvh] place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return <main className="min-h-[100dvh] bg-background text-foreground">
    <header className="sticky top-0 z-40 flex min-h-14 flex-wrap items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:gap-3 sm:px-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/game/slate/${gameId}`)}><ArrowLeft /> Game settings</Button>
      <div className="min-w-0 flex-1"><h1 className="truncate font-semibold">Flow · {game.name}</h1><p className="text-xs text-muted-foreground">Completion character only — no tray or trail</p></div>
      <div className="flex items-center gap-2"><span className="hidden text-xs sm:inline">Enabled</span><Switch aria-label="Enable Game Flow" checked={flow.enabled} onCheckedChange={(enabled) => patchFlow({ enabled })} /></div>
      <Button onClick={() => void save()} disabled={busy}><Save /> Save</Button>
    </header>
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 p-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
      <section className="min-w-0 space-y-4">
        <div className="relative h-[510px] w-full overflow-hidden border border-border bg-muted sm:h-auto sm:min-h-[510px] sm:aspect-video xl:min-h-0">
          <GameCompletionScene key={preview} previewOutcome={preview} game={{ ...game, settings: { ...game.settings, completionFlow: flow } }} summary={{ marks: 9, totalMarks: 9, completionCoins: 3, vaultReward: 5, vaultsOpened: 1, timeEarnedSeconds: 18, livesDelta: 1 }} final={preview === "victory"} failed={preview === "failed"} left={preview === "left"} questionNumber={2} questionTotal={5} onContinue={() => undefined} onRetry={() => undefined} onExit={() => undefined} creatorControls onCharacterPlacementChange={(position) => patchFlow({ position })} />
        </div>
        <div className="border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="icon" variant="outline" onClick={() => { const video = videoRef.current; if (!video) return; if (video.paused) { void video.play(); setPlaying(true); } else { video.pause(); setPlaying(false); } }}>{playing ? <Pause /> : <Play />}</Button>
            <Slider className="min-w-48 flex-1" min={0} max={duration || 1} step={0.05} value={[time]} onValueChange={([value]) => seek(value ?? 0)} />
            <span className="text-xs tabular-nums">{time.toFixed(1)} / {duration.toFixed(1)}s</span>
          </div>
          {src ? <video ref={videoRef} src={src} playsInline className="mt-3 max-h-44 w-full bg-muted object-contain" onLoadedData={() => { if (videoRef.current && pendingSeek.current !== null) { videoRef.current.currentTime = pendingSeek.current; pendingSeek.current = null; } }} onTimeUpdate={(event) => setTime(offset + event.currentTarget.currentTime)} /> : null}
        </div>
      </section>
      <aside className="space-y-4">
        <section className="space-y-2 border border-border bg-card p-4"><h2 className="font-semibold">Shared Flow character</h2><p className="text-xs text-muted-foreground">The same Flows, videos and scenes as Lesson Notes. Size and position here apply to this Game only.</p>
          <select aria-label="Shared Flow" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={flow.flowId ?? ""} onChange={(event) => applyShared(shared.find((item) => item.id === event.target.value) ?? null)}><option value="">— None (Game-only clips) —</option>{shared.map((item) => <option key={item.id} value={item.id}>{item.name}{item.scope === "mathgpl" ? " · MathGPL" : ""}</option>)}</select>
          {linked ? <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => navigate(`/flows/${linked.id}`)}>Open Flow editor</Button><Button size="sm" variant="ghost" onClick={() => void listFlows().then((list) => { setShared(list); applyShared(list.find((item) => item.id === linked.id) ?? null); })}>Refresh scenes</Button></div> : null}
          <p className="text-sm">Emotion reactions are available to creators and students.</p>
        </section>
        <section className="border border-border bg-card p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Character video</h2><Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}><Upload /> Upload</Button><input ref={fileRef} hidden multiple type="file" accept="video/*" onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} /></div>
          {flow.clips.length === 0 ? <p className="text-sm text-muted-foreground">Upload a character video, then mark the five moments below. Transparent WebM works best.</p> : <ul className="space-y-2">{flow.clips.map((clip) => <li key={clip.id} className="space-y-2 border border-border bg-background p-2"><div className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{clip.name}</span><span className="text-xs text-muted-foreground">{clip.duration.toFixed(1)}s</span><Button variant="ghost" size="icon-sm" aria-label="Remove clip" onClick={() => patchFlow({ clips: flow.clips.filter((item) => item.id !== clip.id) })}><Trash2 /></Button></div><ClipProcessor clip={clip} notebookId={`game-${gameId}`} onChange={(patch) => patchClip(clip.id, patch)} /></li>)}</ul>}
        </section>
        <section className="border border-border bg-card p-4"><h2 className="mb-3 font-semibold">Game events</h2><div className="space-y-2">{MOMENTS.map((moment) => { const range = flow.moments[moment.id]; return <article key={moment.id} className={`border p-3 ${preview === moment.id ? "border-primary bg-primary/5" : "border-border bg-background"}`}><button type="button" className="w-full text-left" onClick={() => setPreview(moment.id)}><div className="font-semibold">{moment.label}</div><div className="text-xs text-muted-foreground">{moment.note}</div></button>{linked ? <select aria-label={`${moment.label} scene`} className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs" value={flow.sceneIds?.[moment.id] ?? ""} onChange={(event) => assignScene(moment.id, event.target.value)}><option value="">Custom range below</option>{ranges.map((r) => <option key={r.id} value={r.id}>{sceneLabel(r)} · {r.name} ({r.start.toFixed(1)}–{r.end.toFixed(1)}s)</option>)}</select> : null}<div className="mt-2 flex items-center gap-2 text-xs"><Button size="sm" variant="outline" onClick={() => setMomentStart(moment.id)}>Start {range?.start.toFixed(1) ?? "—"}s</Button><Button size="sm" variant="outline" onClick={() => setMomentEnd(moment.id)}>End {range?.end.toFixed(1) ?? "—"}s</Button>{range ? <Button size="icon-sm" variant="ghost" onClick={() => patchFlow({ moments: { ...flow.moments, [moment.id]: null } })}><Trash2 /></Button> : null}</div></article>; })}</div></section>
        <section className="space-y-3 border border-border bg-card p-4"><h2 className="font-semibold">Placement</h2>{([['x','Horizontal'],['y','Vertical'],['scale','Size'],['volume','Volume']] as const).map(([key,label]) => <label key={key} className="block text-xs text-muted-foreground">{label}<Slider className="mt-2" min={key === 'scale' ? 0.3 : 0} max={key === 'scale' ? 2.5 : key === 'volume' ? 1 : 100} step={key === 'volume' ? 0.05 : 1} value={[flow.position[key]]} onValueChange={([value]) => patchFlow({ position: { ...flow.position, [key]: value ?? flow.position[key] } })} /></label>)}</section>
      </aside>
    </div>
  </main>;
}