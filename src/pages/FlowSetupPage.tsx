import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import { ArrowLeft, ImagePlus, Loader2, Lock, Pause, Play, Plus, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { canEditFlow, flowUrl, isAdmin, loadFlow, saveFlow, sendToLibrary, uploadFlowBlob, uploadFlowClip, videoDuration } from "@/lib/flow/api";
import { probeTransparencyFromUrl } from "@/lib/flow/alpha";
import { fmt, locate, totalDuration, validateScenes, withRanges } from "@/lib/flow/segments";
import { TRAIL_PRESETS, type FlowConfig, type SceneType } from "@/lib/flow/types";
import ClipProcessor, { previewBgStyle, type PreviewBg } from "@/components/flow/ClipProcessor";
import FlowCharacter from "@/components/flow/FlowCharacter";
import FlowTrail from "@/components/flow/FlowTrail";

const EMOJIS = "😀😊😃🤩😍🥳😮😯🤔🧐😕😢😡😴👏🙌👍👋🤗🫶❤️⭐✨🔥💡🎉❓❗🎈🌈🦋🧚".match(/\p{Extended_Pictographic}(\uFE0F)?/gu) ?? [];
const TYPE_LABEL: Record<SceneType, string> = { base: "Base", emotion: "Emotion", flow_out: "Flow Out", flow_in: "Flow In" };
const EMOTION_BACKGROUNDS = ["#ffffff", "#f8d7da", "#fff3bf", "#d3f9d8", "#d0ebff", "#e5dbff", "#212529"];
const uid = () => Math.random().toString(36).slice(2, 10);

const FlowSetupPage = () => {
  const { flowId: id = "" } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const backNote = search.get("note");
  const [cfg, setCfg] = useState<FlowConfig | null>(null);
  const [missing, setMissing] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    loadFlow(id).then(async (f) => {
      if (!f) { setMissing(true); return; }
      setCanEdit(await canEditFlow(f));
      setAdmin(await isAdmin());
      setCfg(f);
    });
  }, [id]);
  useEffect(() => {
    if (cfg?.cover_path) flowUrl(cfg.cover_path).then(setCoverUrl); else setCoverUrl(null);
  }, [cfg?.cover_path]);

  // Debounced autosave (owners/admins only).
  const first = useRef(true);
  useEffect(() => {
    if (!cfg || !canEdit) return;
    if (first.current) { first.current = false; return; }
    setSaving(true);
    const t = setTimeout(() => {
      saveFlow(cfg).catch((e) => toast({ title: "Save failed", description: e.message, variant: "destructive" })).finally(() => setSaving(false));
    }, 600);
    return () => clearTimeout(t);
  }, [cfg, canEdit]);

  const onCover = async (f: File | undefined) => {
    if (!f || !cfg) return;
    try {
      const ext = f.name.split(".").pop() || "png";
      const path = await uploadFlowBlob(`covers/${cfg.id}`, f, ext);
      setCfg((c) => c && { ...c, cover_path: path, cover_type: f.type.startsWith("video") ? "video" : "image" });
    } catch (e) { toast({ title: "Cover upload failed", description: (e as Error).message, variant: "destructive" }); }
  };

  // Keep the timeline player's sound at the Flow Volume.
  useEffect(() => {
    const v = videoRef.current; if (!v || !cfg) return;
    const vol = cfg.position.volume ?? 0.75; v.volume = vol; v.muted = vol === 0;
  }, [cfg?.position.volume]); // eslint-disable-line react-hooks/exhaustive-deps

  const [manualSaving, setManualSaving] = useState(false);
  const saveNow = async () => {
    if (!cfg) return;
    setManualSaving(true);
    try {
      await saveFlow(cfg);
      toast({ title: `${cfg.name} saved`, description: "Every lesson note using this Flow gets the update." });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally { setManualSaving(false); }
  };

  const update = (patch: Partial<FlowConfig>) => setCfg((c) => (c ? { ...c, ...patch } : c));
  const total = cfg ? totalDuration(cfg.clips) : 0;
  const ranges = useMemo(() => (cfg ? withRanges(cfg.scenes) : []), [cfg]);
  const errors = cfg ? validateScenes(cfg.scenes) : [];

  // ── Timeline player ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clipIdx, setClipIdx] = useState(0);
  const [src, setSrc] = useState<string>("");
  const pendingSeek = useRef<number | null>(null);

  useEffect(() => {
    const c = cfg?.clips[clipIdx];
    if (!c) { setSrc(""); return; }
    flowUrl(c.path).then((u) => setSrc(u ?? ""));
  }, [cfg?.clips, clipIdx]);

  const seek = (t: number) => {
    if (!cfg?.clips.length) return;
    const l = locate(cfg.clips, t);
    setTime(t);
    if (l.index !== clipIdx) { pendingSeek.current = l.local; setClipIdx(l.index); }
    else if (videoRef.current) videoRef.current.currentTime = l.local;
  };
  const offset = cfg ? cfg.clips.slice(0, clipIdx).reduce((a, c) => a + c.duration, 0) : 0;

  const onUpload = async (files: FileList | null) => {
    if (!files || !cfg) return;
    setBusy(true);
    try {
      const added = [];
      for (const f of Array.from(files)) {
        const [path, duration] = await Promise.all([uploadFlowClip(id, f), videoDuration(f)]);
        // Classify transparency from the file itself. Nothing is removed or
        // re-encoded: a real alpha channel is simply preserved.
        const local = URL.createObjectURL(f);
        const transparency = await probeTransparencyFromUrl(local, path);
        URL.revokeObjectURL(local);
        if (transparency === "alpha") toast({ title: "Transparent Video", description: `${f.name} has an alpha channel. Transparency is preserved.` });
        else if (transparency === "opaque") toast({ title: "No transparency", description: `${f.name} is opaque and contains no transparency. Nothing was removed.` });
        added.push({ id: uid(), path, name: f.name, duration, removeBg: false, keyColor: null, transparency });
      }
      const clips = [...cfg.clips, ...added];
      const scenes = cfg.scenes.length ? cfg.scenes : [{ id: uid(), end: totalDuration(clips), name: "Scene 1", type: "base" as SceneType }];
      update({ clips, scenes });
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const [pbg, setPbg] = useState<PreviewBg>("checker");
  const [pbgCustom, setPbgCustom] = useState("#22c55e");

  const addScene = () => {
    if (!cfg) return;
    const t = Math.round(time * 10) / 10;
    if (t <= 0 || cfg.scenes.some((s) => Math.abs(s.end - t) < 0.05)) {
      toast({ title: "Move the playhead", description: "Pause at a new point on the timeline, then Add Scene." });
      return;
    }
    update({ scenes: [...cfg.scenes, { id: uid(), end: t, name: `Scene ${cfg.scenes.length + 1}`, type: "emotion" }] });
  };
  const patchScene = (sid: string, p: Partial<FlowConfig["scenes"][number]>) =>
    cfg && update({ scenes: cfg.scenes.map((s) => (s.id === sid ? { ...s, ...p } : s)) });

  // Scene preview (keyed, played through the real engine).
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(null);
  const [pk, setPk] = useState(0);

  // Trail preview: orb orbits inside the box.
  const trailBox = useRef<HTMLDivElement>(null);
  const trailPoint = () => {
    const el = trailBox.current;
    if (!el) return null;
    const t = performance.now() / 1000;
    const moving = t % 9 < 4;
    const tt = moving ? t : Math.floor(t / 9) * 9 + 4;
    return { x: el.clientWidth / 2 + Math.cos(tt * 1.4) * el.clientWidth * 0.32, y: el.clientHeight / 2 + Math.sin(tt * 2.1) * el.clientHeight * 0.3 };
  };

  if (missing) return <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">Flow not found.<Button onClick={() => navigate("/flows")}>Back to Flows</Button></div>;
  if (!cfg) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={() => navigate(backNote ? `/lesson-notes/${backNote}/flow` : "/flows")} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> {backNote ? "Select Flow" : "Flows"}
        </Button>
        <button type="button" disabled={!canEdit} onClick={() => coverRef.current?.click()} className="relative h-9 w-14 overflow-hidden rounded border border-border bg-muted" title="Cover picture or video">
          {coverUrl ? (cfg.cover_type === "video" ? <video src={coverUrl} muted autoPlay loop className="h-full w-full object-cover" /> : <img src={coverUrl} alt="" className="h-full w-full object-cover" />) : <ImagePlus className="mx-auto h-4 w-4 text-muted-foreground" />}
        </button>
        <input ref={coverRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => onCover(e.target.files?.[0])} />
        <Input value={cfg.name} disabled={!canEdit} onChange={(e) => update({ name: e.target.value })} className="h-8 max-w-[220px] text-sm font-semibold" aria-label="Flow name" />
        <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{cfg.scope === "mathgpl" ? "MathGPL Flow" : "My Flow"}</span>
        <div className="flex-1" />
        {cfg.scope === "mathgpl" && admin && (
          <label className="flex items-center gap-2 text-xs">
            {cfg.status === "published" ? "Published" : "Draft"}
            <Switch checked={cfg.status === "published"} onCheckedChange={(on) => update({ status: on ? "published" : "draft" })} aria-label="Published" />
          </label>
        )}
        {canEdit ? (
          <>
            <span className="text-xs text-muted-foreground">{saving ? "Saving…" : "Saved"}</span>
            <Button size="sm" disabled={manualSaving} onClick={saveNow} className="gap-1.5">
              {manualSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
            </Button>
            {admin && cfg.scope === "personal" && (
              <Button size="sm" variant="outline" onClick={async () => {
                try { await saveFlow(cfg); const r = await sendToLibrary(cfg.id); toast({ title: r === "updated" ? "MathGPL Flow updated" : "Sent to MathGPL Flow", description: `${cfg.name} is now available to everyone.` }); }
                catch (e) { toast({ title: "Could not send", description: (e as Error).message, variant: "destructive" }); }
              }}>Send to MathGPL Flow</Button>
            )}
          </>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> View only</span>
        )}
      </header>
      {!canEdit && <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">This is a MathGPL Flow. You can preview it and use it in your lesson notes. To change it, use "Copy to My Flows" in the MathGPL Flow library.</div>}

      <div className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Upload */}
          <section className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Transparent Video</h2>
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : cfg.clips.length ? <Plus className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                {cfg.clips.length ? "Add more videos" : "Upload video"}
              </Button>
              <input ref={fileRef} type="file" accept="video/*" multiple hidden onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }} />
            </div>
            {cfg.clips.length === 0 && <p className="text-sm text-muted-foreground">Upload transparent character clips (WebM with alpha works best). They play back to back as one timeline, and their transparency is kept exactly as it is.</p>}
            <ul className="space-y-2">
              {cfg.clips.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span className="w-5 text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{fmt(c.duration)}</span>
                  <ClipProcessor clip={c} notebookId={id} onChange={(p) => setCfg((cur) => cur && { ...cur, clips: cur.clips.map((x) => (x.id === c.id ? { ...x, ...p } : x)) })} />
                  <button aria-label="Remove clip" onClick={() => update({ clips: cfg.clips.filter((_, k) => k !== i) })} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Scene editor */}
          {cfg.clips.length > 0 && (
            <section className="rounded-lg border border-border p-4">
              <h2 className="mb-3 font-semibold">Scenes</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
                  {src && (
                    <video
                      ref={videoRef}
                      src={src}
                      crossOrigin="anonymous"
                      playsInline
                      className="h-full w-full object-contain"
                      onLoadedData={() => {
                        if (videoRef.current) { const v = cfg.position.volume ?? 0.75; videoRef.current.volume = v; videoRef.current.muted = v === 0; } if (pendingSeek.current != null && videoRef.current) { videoRef.current.currentTime = pendingSeek.current; pendingSeek.current = null; if (playing) videoRef.current.play(); } }}
                      onTimeUpdate={(e) => setTime(offset + e.currentTarget.currentTime)}
                      onEnded={() => { if (clipIdx < cfg.clips.length - 1) { pendingSeek.current = 0; setClipIdx(clipIdx + 1); } else setPlaying(false); }}
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="relative aspect-video overflow-hidden rounded-md" style={previewBgStyle(pbg, pbgCustom)}>
                    {preview ? (
                      <FlowCharacter clips={cfg.clips} range={preview} playKey={pk} onSceneEnd={() => setPreview(null)} visible volume={cfg.position.volume ?? 0.75} />
                    ) : (
                      <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-muted-foreground">Click ▶ on a scene to preview it. The checkerboard behind the character is only this preview's transparency backdrop.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Preview background:</span>
                    {(["checker", "white", "black", "custom"] as PreviewBg[]).map((b) => (
                      <button key={b} onClick={() => setPbg(b)} className={`rounded border px-2 py-0.5 capitalize ${pbg === b ? "border-primary bg-primary/10" : "border-border"}`}>{b === "checker" ? "Checkerboard" : b}</button>
                    ))}
                    {pbg === "custom" && <input type="color" value={pbgCustom} onChange={(e) => setPbgCustom(e.target.value)} className="h-5 w-7" />}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Button size="icon" variant="outline" onClick={() => { const v = videoRef.current; if (!v) return; if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); } }}>
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <div className="relative flex-1">
                  <Slider value={[time]} max={total || 1} step={0.05} onValueChange={([v]) => seek(v)} />
                  {ranges.map((r) => (
                    <span key={r.id} className="pointer-events-none absolute -top-1 h-4 w-0.5 bg-primary" style={{ left: `${(r.end / (total || 1)) * 100}%` }} />
                  ))}
                </div>
                <span className="w-24 text-right text-xs tabular-nums">{fmt(time)} / {fmt(total)}</span>
                <Button size="sm" onClick={addScene} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Scene</Button>
              </div>

              <table className="mt-4 w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-1">#</th><th>Start – End</th><th>Name / Emoji</th><th>Type</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {ranges.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-1.5">{r.index + 1}</td>
                      <td className="whitespace-nowrap">
                        {fmt(r.start)} –{" "}
                        <Input type="number" step={0.1} min={0} max={total} value={r.end} onChange={(e) => patchScene(r.id, { end: Math.min(total, Math.max(0, Number(e.target.value))) })} className="inline-block h-7 w-20 px-1.5" />
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Input value={r.name} onChange={(e) => patchScene(r.id, { name: e.target.value })} className="h-7" />
                          <Popover>
                            <PopoverTrigger asChild><Button size="sm" variant="ghost" className="h-7 px-2" aria-label="Pick emoji">{r.emoji || "😊"}</Button></PopoverTrigger>
                            <PopoverContent className="grid w-64 grid-cols-8 gap-1 p-2">
                              {EMOJIS.map((em) => (
                                <button key={em} className="rounded p-1 text-lg hover:bg-accent" onClick={() => patchScene(r.id, { emoji: em, name: r.name.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "").trim() || r.name, display: r.display ?? "emoji" })}>{em}</button>
                              ))}
                            </PopoverContent>
                          </Popover>
                          {r.type === "emotion" && (
                            <Select value={r.display ?? (r.emoji || /^\p{Extended_Pictographic}/u.test(r.name) ? "emoji" : "text")} onValueChange={(v) => patchScene(r.id, { display: v as "emoji" | "text" })}>
                              <SelectTrigger className="h-7 w-24" title="Show on Smartboard as"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="emoji">Emoji</SelectItem><SelectItem value="text">Text</SelectItem></SelectContent>
                            </Select>
                          )}
                        </div>
                      </td>
                      <td>
                        <Select value={r.type} onValueChange={(v) => patchScene(r.id, { type: v as SceneType })}>
                          <SelectTrigger className="h-7 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>{(Object.keys(TYPE_LABEL) as SceneType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Preview scene" onClick={() => { setPreview({ start: r.start, end: r.end }); setPk((k) => k + 1); seek(r.start); }}><Play className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Delete scene" disabled={cfg.scenes.length <= 1} onClick={() => update({ scenes: cfg.scenes.filter((s) => s.id !== r.id) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                Only the end point is set; the start is automatic. One Base, one Flow Out, one Flow In; as many Emotions as you like.
                {errors.length > 0 && <ul className="mt-2 list-disc pl-4 text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-border p-4">
            <h2 className="mb-3 font-semibold">Trail</h2>
            <div className="mb-3 grid grid-cols-6 gap-1.5">
              {TRAIL_PRESETS.map((p) => (
                <button key={p.name} title={p.name} onClick={() => update({ trail: { ...cfg.trail, color: p.color } })}
                  className={`h-8 rounded-md border-2 ${cfg.trail.color === p.color ? "border-foreground" : "border-transparent"}`} style={{ background: p.color }} />
              ))}
            </div>
            <label className="mb-3 flex items-center gap-2 text-xs">Custom <input type="color" value={cfg.trail.color} onChange={(e) => update({ trail: { ...cfg.trail, color: e.target.value } })} /></label>
            {([["length", "Length"], ["thickness", "Thickness"], ["glow", "Glow"], ["vibration", "Vibration"]] as const).map(([k, label]) => (
              <div key={k} className="mb-3">
                <p className="mb-1 text-xs">{label}</p>
                <Slider value={[cfg.trail[k]]} max={1} step={0.01} onValueChange={([v]) => update({ trail: { ...cfg.trail, [k]: v } })} />
              </div>
            ))}
            <div className="mb-3">
              <p className="mb-1 text-xs">Trail mode</p>
              <div className="grid grid-cols-2 gap-2">
                {([["solution", "Only on solution"], ["always", "Always on"]] as const).map(([m, label]) => {
                  const on = (cfg.position.trailMode ?? "solution") === m;
                  return (
                    <button key={m} type="button" onClick={() => update({ position: { ...cfg.position, trailMode: m } })}
                      className={`rounded-md border px-2 py-1.5 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mb-3">
              <p className="mb-1 text-xs">Fade time: {cfg.trail.fadeSec.toFixed(1)}s</p>
              <Slider value={[cfg.trail.fadeSec]} min={0.3} max={5} step={0.1} onValueChange={([v]) => update({ trail: { ...cfg.trail, fadeSec: v } })} />
            </div>
            <div ref={trailBox} className="relative h-36 overflow-hidden rounded-md bg-foreground/90">
              <FlowTrail active contained settings={cfg.trail} getPoint={trailPoint} />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Preview pauses for a while to show the trail fading after 10s.</p>
          </section>

          <section className="rounded-lg border border-border p-4">
            <h2 className="mb-2 font-semibold">Character position</h2>
            <p className="mb-2 text-xs text-muted-foreground">Drag the Fairy anywhere on the board and zoom her with − / +. On the Smartboard you can also move your pointer near her or the emotion buttons to drag and resize them there. Your placement is saved.</p>
            <PlacementStage value={cfg.position} onChange={(position) => update({ position })} />
          </section>

          <section className="rounded-lg border border-border p-4">
            <h2 className="mb-2 font-semibold">Flow Volume</h2>
            <p className="mb-2 text-xs text-muted-foreground">One volume for every Flow video (Base, Emotions, Flow Out, Flow In).</p>
            <div className="flex items-center gap-3">
              <span aria-hidden>🔊</span>
              <Slider className="flex-1" value={[Math.round((cfg.position.volume ?? 0.75) * 100)]} min={0} max={100} step={1} onValueChange={([v]) => update({ position: { ...cfg.position, volume: v / 100 } })} />
              <span className="w-10 text-right text-xs tabular-nums">{Math.round((cfg.position.volume ?? 0.75) * 100)}%</span>
            </div>
          </section>

          <section className="rounded-lg border border-border p-4">
            <h2 className="mb-2 font-semibold">Emotion background</h2>
            <div className="flex flex-wrap items-center gap-2">
              {EMOTION_BACKGROUNDS.map((color) => (
                <Button
                  key={color}
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Use ${color} for emotion background`}
                  title={color}
                  onClick={() => update({ position: { ...cfg.position, emotionBackground: color } })}
                  className={`h-8 w-8 p-1 ${cfg.position.emotionBackground === color ? "ring-2 ring-primary ring-offset-2" : ""}`}
                >
                  <span className="h-full w-full rounded-sm border border-border" style={{ backgroundColor: color }} />
                </Button>
              ))}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Custom
                <input
                  type="color"
                  value={cfg.position.emotionBackground ?? "#ffffff"}
                  onChange={(e) => update({ position: { ...cfg.position, emotionBackground: e.target.value } })}
                  className="h-8 w-10 cursor-pointer"
                  aria-label="Custom emotion background color"
                />
              </label>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
};

// Mini Smartboard: drag the character box anywhere, zoom with − / +.
const PlacementStage = ({ value, onChange }: { value: FlowConfig["position"]; onChange: (v: FlowConfig["position"]) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const ch = value.character ?? { x: 0.85, y: 0.65, scale: value.scale ?? 1 };
  const set = (p: Partial<typeof ch>) => { const c = { ...ch, ...p }; onChange({ ...value, character: c, scale: c.scale }); };
  const drag = (e: React.PointerEvent) => {
    e.preventDefault();
    const r = ref.current!.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, start = ch;
    const move = (ev: PointerEvent) => set({ x: Math.min(1, Math.max(0, start.x + (ev.clientX - sx) / r.width)), y: Math.min(1, Math.max(0, start.y + (ev.clientY - sy) / r.height)) });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const zoom = (f: number) => set({ scale: Math.min(10, Math.max(0.3, +(ch.scale * f).toFixed(2))) });
  // Character box: 20% of board width at 100%, portrait 3:4.
  const bw = 20 * ch.scale;
  return (
    <div>
      <div ref={ref} className="relative aspect-video touch-none overflow-hidden rounded-md border border-border bg-muted/40">
        <div onPointerDown={drag} className="absolute flex cursor-grab items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/10 text-[10px] text-primary active:cursor-grabbing"
          style={{ width: `${bw}%`, aspectRatio: "3 / 4", left: `${ch.x * 100}%`, top: `${ch.y * 100}%`, transform: "translate(-50%, -50%)" }}>
          Fairy
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Zoom out" onClick={() => zoom(0.9)}>−</Button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(ch.scale * 100)}%</span>
        <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Zoom in" onClick={() => zoom(1.1)}>+</Button>
      </div>
    </div>
  );
};

export default FlowSetupPage;
