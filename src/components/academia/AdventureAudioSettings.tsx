// Three-dot sound settings on an Academia Session Adventure card: how loud the
// Game music is while the narrator speaks, the narrator's own level, and the
// narration times on the video. Saved for this Session's Adventure only.
import { useEffect, useRef, useState } from "react";
import { MoreVertical, Plus, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_AUDIO, normalizeAudio, type AdventureAudio } from "@/lib/academia/adventureMix";
import { loadAdventureAudio, saveAdventureAudio } from "@/lib/academia/adventureSlots";

const toClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const fromClock = (v: string): number => {
  const parts = v.trim().split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return NaN;
  return parts.length === 2 ? parts[0]! * 60 + parts[1]! : parts[0]!;
};

export default function AdventureAudioSettings({ activityId, gameId }: { activityId: string; gameId: string | null }) {
  const [open, setOpen] = useState(false);
  const [audio, setAudio] = useState<AdventureAudio>(DEFAULT_AUDIO);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<{ start: string; end: string }[]>([]);
  const preview = useRef<HTMLAudioElement | null>(null);
  const previewTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadAdventureAudio(activityId).then((a) => {
      setAudio(a);
      setRows(a.segments.map((s) => ({ start: toClock(s.start), end: toClock(s.end) })));
    }).catch(() => undefined);
  }, [open, activityId]);

  const stopPreview = () => {
    if (previewTimer.current) window.clearInterval(previewTimer.current);
    previewTimer.current = null;
    preview.current?.pause();
  };
  useEffect(() => () => stopPreview(), []);

  /** Plays the Game music normally, fades it down to the narration level, then back up. */
  const playPreview = async () => {
    stopPreview();
    if (!gameId) { toast.error("Add a Game first — its background music is used."); return; }
    const [{ loadGame }, { gameSoundSettingsOf }, { prepareSound }] = await Promise.all([
      import("@/lib/slate/storage"), import("@/hooks/useGameRuntime"), import("@/lib/slate/gameSound"),
    ]);
    const game = await loadGame(gameId).catch(() => null);
    const bg = gameSoundSettingsOf(game).background;
    const url = bg.ref?.path ? await prepareSound(bg.ref.path) : null;
    if (!url) { toast.error("This Game has no background music."); return; }
    const el = preview.current ?? new Audio();
    preview.current = el;
    el.src = url; el.loop = true; el.volume = bg.volume;
    await el.play().catch(() => undefined);
    const started = Date.now();
    previewTimer.current = window.setInterval(() => {
      const t = (Date.now() - started) / 1000; // 0–3 normal, 3–5 fade, 5–9 ducked, 9–11 back
      const d = t < 3 ? 0 : t < 5 ? (t - 3) / 2 : t < 9 ? 1 : t < 11 ? 1 - (t - 9) / 2 : 0;
      el.volume = Math.max(0, Math.min(1, bg.volume * (1 - d) + Math.min(bg.volume, audio.duckLevel) * d));
      if (t > 12) stopPreview();
    }, 100);
  };

  const save = async () => {
    const segments = rows.map((r) => ({ start: fromClock(r.start), end: fromClock(r.end) }));
    if (segments.some((s) => !(s.end > s.start))) { toast.error("Each narration needs an end time after its start."); return; }
    setSaving(true);
    try {
      await saveAdventureAudio(activityId, normalizeAudio({ ...audio, segments }));
      toast.success("Sound settings saved");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message || "Could not save");
    } finally { setSaving(false); }
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" aria-label="Adventure sound settings" onClick={() => setOpen(true)}>
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <Dialog open onOpenChange={(v) => { if (!v) stopPreview(); setOpen(v); }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>Adventure sound</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">The Game's music plays throughout. It fades down 5 seconds before each narration and back up afterwards. Students only get one master volume.</p>
            <label className="block text-sm font-medium">Background music during narration: {Math.round(audio.duckLevel * 100)}%</label>
            <Slider value={[audio.duckLevel * 100]} min={0} max={100} step={1} onValueChange={([v]) => setAudio((a) => ({ ...a, duckLevel: (v ?? 0) / 100 }))} />
            <label className="block text-sm font-medium">Narrator volume: {Math.round(audio.narratorLevel * 100)}%</label>
            <Slider value={[audio.narratorLevel * 100]} min={0} max={100} step={1} onValueChange={([v]) => setAudio((a) => ({ ...a, narratorLevel: (v ?? 0) / 100 }))} />
            <div className="space-y-2">
              <p className="text-sm font-medium">When the narrator speaks (video time, m:ss)</p>
              {rows.length === 0 && <p className="text-xs text-muted-foreground">No narration times yet. Without them the music stays at its normal level; add each part where the narrator talks.</p>}
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input aria-label="Start" value={r.start} onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} className="w-20 rounded border border-input bg-background px-2 py-1 text-sm" />
                  <span className="text-xs">to</span>
                  <input aria-label="End" value={r.end} onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} className="w-20 rounded border border-input bg-background px-2 py-1 text-sm" />
                  <button type="button" aria-label="Remove" onClick={() => setRows((p) => p.filter((_, j) => j !== i))} className="rounded p-1 hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setRows((p) => [...p, { start: "0:00", end: "0:10" }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add narration time</Button>
            </div>
            <p className="text-xs text-muted-foreground">If the video's own music and narrator are in one soundtrack they can't be separated, so the whole video sound is treated as narration.</p>
            <div className="flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => void playPreview()}><Volume2 className="mr-1 h-4 w-4" /> Preview fade</Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
