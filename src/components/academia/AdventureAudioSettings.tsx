// Three-dot sound window on an Academia Session Adventure card. The teacher
// uploads the Adventure music, hears it while setting its normal level and its
// level under narration, picks fade-in/out seconds, and plays every narration
// clip of the Adventure. What plays here is what the student Adventure plays.
import { useEffect, useRef, useState } from "react";
import { MoreVertical, Pause, Play, Upload, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_AUDIO, duckAmount, normalizeAudio, segmentsFromClips, type AdventureAudio } from "@/lib/academia/adventureMix";
import { loadAdventureAudio, saveAdventureAudio } from "@/lib/academia/adventureSlots";
import type { Narration } from "@/lib/games/types";

const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

type Clip = Narration & { url: string | null; duration: number };

const lengthOf = (url: string) => new Promise<number>((resolve) => {
  const a = new Audio();
  a.preload = "metadata";
  const t = window.setTimeout(() => resolve(0), 8000);
  a.onloadedmetadata = () => { window.clearTimeout(t); resolve(Number.isFinite(a.duration) ? a.duration : 0); };
  a.onerror = () => { window.clearTimeout(t); resolve(0); };
  a.src = url;
});

export default function AdventureAudioSettings({ activityId, gameId, adventureId }: { activityId: string; gameId: string | null; adventureId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [audio, setAudio] = useState<AdventureAudio>(DEFAULT_AUDIO);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  const [ducked, setDucked] = useState(false);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const music = useRef<HTMLAudioElement | null>(null);
  const voice = useRef<HTMLAudioElement | null>(null);
  const fadeTimer = useRef<number | null>(null);
  const testTimer = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef(audio);
  audioRef.current = audio;

  // Load saved settings, the music link and every narration of the Adventure.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      const a = await loadAdventureAudio(activityId).catch(() => DEFAULT_AUDIO);
      if (!alive) return;
      setAudio(a);
      const { getSignedUrl } = await import("@/lib/games/urls");
      if (a.music?.path) setMusicUrl(await getSignedUrl(a.music.path).catch(() => null));
      else if (gameId) {
        // No upload yet: start from the Game's own music so it can be heard.
        const [{ loadGame }, { gameSoundSettingsOf }, { prepareSound }] = await Promise.all([
          import("@/lib/slate/storage"), import("@/hooks/useGameRuntime"), import("@/lib/slate/gameSound"),
        ]);
        const g = await loadGame(gameId).catch(() => null);
        const p = g ? gameSoundSettingsOf(g).background.ref?.path : null;
        if (alive && p) setMusicUrl(await prepareSound(p));
      }
      if (!adventureId) return;
      setLoadingClips(true);
      const [{ getGame }, { narrationsOf, normalizeCanvas }] = await Promise.all([import("@/lib/games/games"), import("@/lib/games/types")]);
      const row = await getGame(adventureId).catch(() => null);
      const list = row ? narrationsOf(normalizeCanvas(row.canvas)) : [];
      const loaded = await Promise.all(list.map(async (n) => {
        const url = n.source === "url" ? n.path : await getSignedUrl(n.path).catch(() => null);
        return { ...n, url, duration: url ? await lengthOf(url) : 0 };
      }));
      if (alive) { setClips(loaded.sort((x, y) => x.at - y.at)); setLoadingClips(false); }
    })();
    return () => { alive = false; };
  }, [open, activityId, gameId, adventureId]);

  const stopAll = () => {
    if (fadeTimer.current) window.clearInterval(fadeTimer.current);
    if (testTimer.current) window.clearInterval(testTimer.current);
    fadeTimer.current = null; testTimer.current = null;
    music.current?.pause();
    voice.current?.pause();
    setMusicOn(false); setPlayingClip(null); setTesting(false); setDucked(false);
  };
  useEffect(() => () => stopAll(), []);

  // Live volume while the music is playing (not during a fade or the full test).
  useEffect(() => {
    if (!music.current || fadeTimer.current || testTimer.current) return;
    const v = ducked ? Math.min(audio.musicVolume, audio.duckLevel) : audio.musicVolume;
    music.current.volume = v;
    music.current.muted = v <= 0; // iPhone/iPad ignore volume, so 0 must mute
  }, [audio.musicVolume, audio.duckLevel, ducked]);
  useEffect(() => { if (voice.current) { voice.current.volume = audio.narratorLevel; voice.current.muted = audio.narratorLevel <= 0; } }, [audio.narratorLevel]);

  const startMusic = async () => {
    if (!musicUrl) { toast.error("Upload the Adventure music first."); return; }
    const el = music.current ?? new Audio();
    music.current = el;
    if (el.src !== musicUrl) el.src = musicUrl;
    el.loop = true;
    el.volume = audioRef.current.musicVolume;
    try { await el.play(); setMusicOn(true); } catch { toast.error("This music file could not play."); }
  };

  /** Smoothly move the music between its normal and narration level. */
  const fadeTo = (down: boolean) => {
    if (!music.current) return;
    if (fadeTimer.current) window.clearInterval(fadeTimer.current);
    const a = audioRef.current;
    const secs = down ? a.fadeIn : a.fadeOut;
    const from = music.current.volume;
    const to = down ? Math.min(a.musicVolume, a.duckLevel) : a.musicVolume;
    const t0 = Date.now();
    setDucked(down);
    fadeTimer.current = window.setInterval(() => {
      const k = secs > 0 ? Math.min(1, (Date.now() - t0) / (secs * 1000)) : 1;
      if (music.current) music.current.volume = from + (to - from) * k;
      if (k >= 1 && fadeTimer.current) { window.clearInterval(fadeTimer.current); fadeTimer.current = null; }
    }, 50);
  };

  const playClip = (c: Clip) => {
    if (!c.url) { toast.error("This narration file is missing."); return; }
    if (playingClip === c.id) { voice.current?.pause(); setPlayingClip(null); return; }
    const el = voice.current ?? new Audio();
    voice.current = el;
    el.src = c.url;
    el.volume = audioRef.current.narratorLevel;
    el.onended = () => setPlayingClip(null);
    void el.play().then(() => setPlayingClip(c.id)).catch(() => toast.error("This narration could not play."));
  };

  /** Whole mix: music, then each narration in turn with the real fades. */
  const testMix = async () => {
    stopAll();
    const usable = clips.filter((c) => c.url && c.duration > 0);
    if (!usable.length) { toast.error("No narration clips to test."); return; }
    await startMusic();
    if (!music.current) return;
    const a = audioRef.current;
    let cursor = a.fadeIn + 1;
    const plan = usable.map((c) => { const s = { clip: c, start: cursor, end: cursor + c.duration }; cursor = s.end + a.fadeOut + a.fadeIn + 1; return s; });
    const segs = plan.map((p) => ({ start: p.start, end: p.end }));
    const t0 = Date.now();
    let next = 0;
    setTesting(true);
    testTimer.current = window.setInterval(() => {
      const t = (Date.now() - t0) / 1000;
      const cur = audioRef.current;
      const d = duckAmount(t, segs, cur.fadeIn, cur.fadeOut);
      if (music.current) music.current.volume = cur.musicVolume * (1 - d) + Math.min(cur.musicVolume, cur.duckLevel) * d;
      if (next < plan.length && t >= plan[next]!.start) { playClip(plan[next]!.clip); next += 1; }
      if (t > cursor) stopAll();
    }, 50);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { uploadSound } = await import("@/lib/games/adventureAudio");
      const { getSignedUrl } = await import("@/lib/games/urls");
      const path = await uploadSound(file, file.name);
      stopAll();
      setAudio((a) => ({ ...a, music: { path, name: file.name } }));
      setMusicUrl(await getSignedUrl(path));
      toast.success("Music uploaded — press Play to hear it, then Save.");
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
    } finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const measured = segmentsFromClips(clips.map((c) => ({ at: c.at, duration: c.duration })));
      await saveAdventureAudio(activityId, normalizeAudio({ ...audio, segments: measured }));
      toast.success("Sound settings saved");
      stopAll();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message || "Could not save");
    } finally { setSaving(false); }
  };

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const fadeField = (label: string, key: "fadeIn" | "fadeOut") => (
    <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
      {label}
      <input
        type="number" min={0} max={30} step={0.5} value={audio[key]}
        onChange={(e) => setAudio((a) => ({ ...a, [key]: Math.min(30, Math.max(0, Number(e.target.value) || 0)) }))}
        className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
      />
    </label>
  );

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" aria-label="Adventure sound settings" onClick={() => setOpen(true)}>
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <Dialog open onOpenChange={(v) => { if (!v) stopAll(); setOpen(v); }}>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>Adventure sound</DialogTitle></DialogHeader>

            <section className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">Background music</p>
              <p className="truncate text-xs text-muted-foreground">
                {audio.music ? (audio.music.name ?? audio.music.path.split("/").pop()) : musicUrl ? "Using the Game's music — upload to replace it" : "No music yet"}
              </p>
              <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : audio.music ? "Replace music" : "Upload music"}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!musicUrl} onClick={() => (musicOn ? stopAll() : void startMusic())}>
                  {musicOn ? <><Pause className="mr-1 h-4 w-4" /> Stop</> : <><Play className="mr-1 h-4 w-4" /> Play</>}
                </Button>
              </div>
              <label className="block text-sm font-medium">Normal volume: {pct(audio.musicVolume)}</label>
              <Slider value={[audio.musicVolume * 100]} min={0} max={100} step={1} onValueChange={([v]) => setAudio((a) => ({ ...a, musicVolume: (v ?? 0) / 100 }))} />
              <label className="block text-sm font-medium">Volume while the narrator talks: {pct(audio.duckLevel)}</label>
              <Slider value={[audio.duckLevel * 100]} min={0} max={100} step={1} onValueChange={([v]) => setAudio((a) => ({ ...a, duckLevel: (v ?? 0) / 100 }))} />
              <Button type="button" size="sm" variant="outline" disabled={!musicOn} onClick={() => fadeTo(!ducked)}>
                <Volume2 className="mr-1 h-4 w-4" /> {ducked ? "Back to normal" : "Hear it under narration"}
              </Button>
              <div className="flex gap-3">
                {fadeField("Fade in (seconds)", "fadeIn")}
                {fadeField("Fade out (seconds)", "fadeOut")}
              </div>
            </section>

            <section className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">Narrations</p>
              <label className="block text-sm font-medium">Narrator volume: {pct(audio.narratorLevel)}</label>
              <Slider value={[audio.narratorLevel * 100]} min={0} max={100} step={1} onValueChange={([v]) => setAudio((a) => ({ ...a, narratorLevel: (v ?? 0) / 100 }))} />
              {loadingClips && <p className="text-xs text-muted-foreground">Loading narrations…</p>}
              {!loadingClips && clips.length === 0 && <p className="text-xs text-muted-foreground">This Adventure has no narrations yet.</p>}
              <ul className="space-y-1">
                {clips.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-sm">
                    <button type="button" aria-label={`Play narration ${i + 1}`} onClick={() => playClip(c)} className="rounded-full bg-primary p-1.5 text-primary-foreground">
                      {playingClip === c.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                    <span className="min-w-0 flex-1 truncate">Narration {i + 1}{c.title ? ` · ${c.title}` : ""}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">at {clock(c.at)} · {c.url ? (c.duration ? `${c.duration.toFixed(1)}s` : "?") : "missing"}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="flex justify-between gap-2">
              <Button type="button" variant="outline" disabled={!musicUrl || clips.length === 0} onClick={() => (testing ? stopAll() : void testMix())}>
                {testing ? "Stop test" : "Test the whole mix"}
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
