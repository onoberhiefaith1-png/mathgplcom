// Background Sound settings — the global MATHGPL soundtrack.
import { useRef, useState } from "react";
import { Music, Upload, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useHomepageConfig } from "@/lib/homepage/homepageConfig";
import { uploadSound } from "@/lib/games/adventureAudio";
import { unlockAudio } from "@/lib/games/audio";

const BackgroundSoundSettings = () => {
  const { config, save, saving } = useHomepageConfig();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const enabled = config.soundtrackEnabled === true;
  const volume = typeof config.soundtrackVolume === "number" ? config.soundtrackVolume : 0.4;
  const title = config.soundtrack?.path ? config.soundtrack.path.split("/").pop() ?? "Soundtrack" : null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadSound(file, file.name);
      await save({
        soundtrack: { path, source: "storage", mediaType: "video" },
        soundtrackEnabled: true,
      });
      unlockAudio();
      toast.success("Background sound saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <Music className="h-5 w-5 text-muted-foreground" />
        <span className="text-base font-medium">Background sound</span>
      </header>
      <div className="space-y-5 px-5 py-5">
        <p className="text-sm text-muted-foreground">
          Plays quietly across MathGPL and stops automatically inside an Adventure, then
          resumes when you leave.
        </p>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{title ? "Current track" : "No track yet"}</p>
            {title ? <p className="truncate text-xs text-muted-foreground">{title}</p> : null}
          </div>
          <Switch
            checked={enabled}
            disabled={!config.soundtrack?.path || saving}
            onCheckedChange={(v) => {
              unlockAudio();
              void save({ soundtrackEnabled: v });
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Slider
            value={[Math.round(volume * 100)]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => void save({ soundtrackVolume: (v ?? 40) / 100 })}
          />
          <span className="w-10 text-right text-xs text-muted-foreground">{Math.round(volume * 100)}%</span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          {busy ? "Uploading…" : config.soundtrack?.path ? "Replace track" : "Upload track"}
        </Button>
      </div>
    </section>
  );
};

export default BackgroundSoundSettings;
