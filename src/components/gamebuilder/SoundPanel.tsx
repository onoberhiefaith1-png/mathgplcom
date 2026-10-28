// Sound Library — ambience, per-scene environmental music and event effects.
//
// Every clip is uploaded by the teacher; the system never generates audio.
import { useRef, useState } from "react";
import { Music, Trash2, Upload, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { uploadSound } from "@/lib/games/adventureAudio";
import { playSfx } from "@/lib/games/audio";
import { getSignedUrl } from "@/lib/games/urls";
import type { AdventureSounds, Scene, SoundEvent, SoundRef } from "@/lib/games/types";

interface SoundPanelProps {
  sounds: AdventureSounds;
  scenes: Scene[];
  /** Scene / Learning Point the environmental music slot applies to. */
  activeSceneId: string | null;
  /** Wording differs between the two modes; the model does not. */
  sceneNoun?: string;
  onChange: (next: AdventureSounds) => void;
  onClose: () => void;
}

const EVENTS: { id: SoundEvent; label: string }[] = [
  { id: "loop_start", label: "Enter stage" },
  { id: "goal", label: "Goal reached" },
  { id: "time_up", label: "Time up" },
  { id: "reward", label: "Reward" },
];

const nameOf = (ref?: SoundRef | null) => (ref?.title || ref?.path?.split("/").pop() || "") as string;

const SoundPanel = ({
  sounds,
  scenes,
  activeSceneId,
  sceneNoun = "Scene",
  onChange,
  onClose,
}: SoundPanelProps) => {
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef<((ref: SoundRef) => void) | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? null;
  const music = activeSceneId ? sounds.music?.[activeSceneId] ?? null : null;

  const pick = (slot: string, apply: (ref: SoundRef) => void) => {
    setBusy(slot);
    pending.current = apply;
    fileRef.current?.click();
  };

  const handleFile = async (file: File | null) => {
    const apply = pending.current;
    pending.current = null;
    if (!file || !apply) { setBusy(null); return; }
    try {
      const path = await uploadSound(file, file.name);
      apply({ path, source: "storage", title: file.name.replace(/\.[^.]+$/, ""), volume: 0.7 });
      toast({ title: "Sound added" });
    } catch (e) {
      console.error(e);
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const preview = async (ref?: SoundRef | null) => {
    if (!ref?.path) return;
    const url = ref.source === "url" ? ref.path : await getSignedUrl(ref.path);
    playSfx(url, ref.volume ?? 1);
  };

  const row = (
    slot: string,
    label: string,
    ref: SoundRef | null,
    set: (next: SoundRef | null) => void,
    disabled = false,
  ) => (
    <div key={slot} className="rounded-md border border-border/50 px-1.5 py-1">
      <div className="flex items-center gap-1">
        <span className="w-24 shrink-0 truncate text-[11px] font-medium">{label}</span>
        <span className="flex-1 truncate text-[10px] text-muted-foreground">
          {ref ? nameOf(ref) : disabled ? "—" : "none"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          disabled={!ref}
          onClick={() => void preview(ref)}
          title="Preview"
        >
          <Volume2 className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          disabled={disabled || busy === slot}
          onClick={() => pick(slot, set)}
          title="Upload"
        >
          <Upload className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          disabled={!ref}
          onClick={() => set(null)}
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {ref ? (
        <Slider
          className="mt-1"
          value={[Math.round((ref.volume ?? 1) * 100)]}
          min={0}
          max={100}
          step={5}
          onValueChange={([v]) => set({ ...ref, volume: (v ?? 100) / 100 })}
        />
      ) : null}
    </div>
  );

  return (
    <div className="absolute left-3 top-full z-40 mt-1 w-72 rounded-lg border border-border/60 bg-background/98 p-2 shadow-xl backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Music className="h-3.5 w-3.5" /> Sound Library
        </p>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Background ambience (whole game)</Label>
          {row("ambience", "Ambience", sounds.ambience ?? null, (next) =>
            onChange({ ...sounds, ambience: next }),
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Environmental music — {activeScene ? activeScene.title || sceneNoun : `select a ${sceneNoun}`}
          </Label>
          {row(
            "music",
            "Music",
            music,
            (next) => {
              if (!activeSceneId) return;
              const map = { ...(sounds.music ?? {}) };
              if (next) map[activeSceneId] = next;
              else delete map[activeSceneId];
              onChange({ ...sounds, music: map });
            },
            !activeSceneId,
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Sound effects</Label>
          {EVENTS.map((e) =>
            row(`sfx-${e.id}`, e.label, sounds.effects?.[e.id] ?? null, (next) => {
              const map = { ...(sounds.effects ?? {}) };
              if (next) map[e.id] = next;
              else delete map[e.id];
              onChange({ ...sounds, effects: map });
            }),
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => { void handleFile(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
      />
    </div>
  );
};

export default SoundPanel;
