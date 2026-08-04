import { useEffect, useRef, useState } from "react";
import { Mic, Play, Plus, Square, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { uploadNarration } from "@/lib/games/narration";
import { getSignedUrl } from "@/lib/games/urls";
import type { Narration } from "@/lib/games/types";
import { cn } from "@/lib/utils";
import { fmtTime } from "./CheckpointTimeline";

interface NarrationPanelProps {
  narrations: Narration[];
  /** Blue playhead — the activation point for "Assign Narration". */
  playhead: number;
  onChange: (next: Narration[]) => void;
  onClose: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Narration library for a Video Adventure. Teachers pick or add a clip, then
 * assign it to the exact timestamp the blue playhead sits on.
 */
const NarrationPanel = ({ narrations, playhead, onChange, onClose }: NarrationPanelProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(narrations[0]?.id ?? null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => { recRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const addClip = (path: string, title: string) => {
    const clip: Narration = { id: uid(), title, path, source: "storage", at: -1, mode: "once" };
    onChange([...narrations, clip]);
    setSelectedId(clip.id);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadNarration(file, file.name);
      addClip(path, file.name.replace(/\.[^.]+$/, ""));
      toast({ title: "Narration uploaded" });
    } catch (e) {
      console.error(e);
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setBusy(true);
        try {
          const path = await uploadNarration(blob, "recording.webm");
          addClip(path, `Recording ${narrations.length + 1}`);
          toast({ title: "Narration recorded" });
        } catch (e) {
          console.error(e);
          toast({ title: "Could not save recording", variant: "destructive" });
        } finally {
          setBusy(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      console.error(e);
      toast({ title: "Microphone unavailable", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  const preview = async (n: Narration) => {
    const url = n.source === "url" ? n.path : await getSignedUrl(n.path);
    if (!url) return;
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    void audioRef.current.play().catch(() => {});
  };

  const patch = (id: string, p: Partial<Narration>) =>
    onChange(narrations.map((n) => (n.id === id ? { ...n, ...p } : n)));

  const remove = (id: string) => {
    onChange(narrations.filter((n) => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const assign = () => {
    if (!selectedId) {
      toast({ title: "Select a narration first" });
      return;
    }
    patch(selectedId, { at: Math.max(0, playhead) });
    toast({ title: `Narration assigned at ${fmtTime(playhead)}` });
  };

  return (
    <div className="absolute left-3 top-full z-40 mt-1 w-72 rounded-lg border border-border/60 bg-background/98 p-2 shadow-xl backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Narration Library
        </p>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto">
        {narrations.length === 0 && (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">
            No narrations yet — upload or record one below.
          </p>
        )}
        {narrations.map((n) => (
          <div
            key={n.id}
            className={cn(
              "rounded-md border px-1.5 py-1",
              selectedId === n.id ? "border-primary/60 bg-primary/5" : "border-border/50",
            )}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex-1 truncate text-left text-[11px] font-medium"
                onClick={() => setSelectedId(n.id)}
              >
                {n.title}
              </button>
              <span className="tabular-nums text-[10px] text-muted-foreground">
                {n.at >= 0 ? fmtTime(n.at) : "unassigned"}
              </span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => preview(n)} title="Preview">
                <Play className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(n.id)} title="Delete">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {selectedId === n.id && (
              <div className="mt-1 space-y-1">
                <Input
                  value={n.title}
                  onChange={(e) => patch(n.id, { title: e.target.value })}
                  className="h-6 text-[11px]"
                  placeholder="Narration name"
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={n.mode === "once" ? "default" : "outline"}
                    className="h-6 flex-1 px-1 text-[10px]"
                    onClick={() => patch(n.id, { mode: "once" })}
                  >
                    Play Once
                  </Button>
                  <Button
                    size="sm"
                    variant={n.mode === "repeat" ? "default" : "outline"}
                    className="h-6 flex-1 px-1 text-[10px]"
                    onClick={() => patch(n.id, { mode: "repeat" })}
                  >
                    Repeat
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
        <Label className="text-[10px] text-muted-foreground">
          Playhead at {fmtTime(playhead)}
        </Label>
        <Button size="sm" className="h-7 w-full gap-1 text-[11px]" onClick={assign} disabled={!selectedId}>
          <Plus className="h-3.5 w-3.5" /> Assign Narration
        </Button>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 flex-1 gap-1 text-[11px]"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" /> Upload
          </Button>
          {recording ? (
            <Button size="sm" variant="destructive" className="h-7 flex-1 gap-1 text-[11px]" onClick={stopRecording}>
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 flex-1 gap-1 text-[11px]"
              disabled={busy}
              onClick={startRecording}
            >
              <Mic className="h-3.5 w-3.5" /> Record
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => { void handleFile(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
        />
      </div>
    </div>
  );
};

export default NarrationPanel;
