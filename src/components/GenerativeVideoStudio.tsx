import { useState } from "react";
import { Loader2, Sparkles, Film, Image as ImageIcon, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
type Resolution = "480p" | "1080p";
type Duration = 5 | 10;

interface Clip {
  id: string;
  url: string;
  prompt: string;
  aspect: AspectRatio;
  duration: Duration;
  resolution: Resolution;
  createdAt: number;
}

const ASPECTS: AspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];

export default function GenerativeVideoStudio() {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [duration, setDuration] = useState<Duration>(5);
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [startingFrame, setStartingFrame] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const { toast } = useToast();

  const onPickFrame = (file: File | null) => {
    if (!file) {
      setStartingFrame(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setStartingFrame(String(e.target?.result ?? ""));
    reader.readAsDataURL(file);
  };

  const onGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Add a prompt", description: "Describe the scene you want to generate." });
      return;
    }
    setBusy(true);
    try {
      // Provider not yet wired. Surface a clear message instead of failing silently.
      await new Promise((r) => setTimeout(r, 800));
      toast({
        title: "Video provider not connected",
        description:
          "Generative video UI is ready. Connect a provider (fal.ai, Replicate, or Runway) to enable rendering.",
      });
    } catch (err) {
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-border/40 bg-background/70 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Generate a Clip</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="gv-prompt" className="mb-1.5 block text-sm">
                Prompt
              </Label>
              <Textarea
                id="gv-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A slow-motion ember explosion against a black background, cinematic lighting"
                rows={5}
                className="resize-none bg-background/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-sm">Aspect ratio</Label>
                <Select value={aspect} onValueChange={(v) => setAspect(v as AspectRatio)}>
                  <SelectTrigger className="bg-background/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECTS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Duration</Label>
                <Select
                  value={String(duration)}
                  onValueChange={(v) => setDuration(Number(v) as Duration)}
                >
                  <SelectTrigger className="bg-background/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="mb-1.5 block text-sm">Resolution</Label>
                <Select
                  value={resolution}
                  onValueChange={(v) => setResolution(v as Resolution)}
                >
                  <SelectTrigger className="bg-background/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p">480p (fast)</SelectItem>
                    <SelectItem value="1080p">1080p (high quality)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-sm">Starting frame (optional)</Label>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm hover:bg-background/80">
                  <ImageIcon className="h-4 w-4" />
                  {startingFrame ? "Change image" : "Upload image"}
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickFrame(e.target.files?.[0] ?? null)}
                  />
                </label>
                {startingFrame && (
                  <button
                    type="button"
                    onClick={() => setStartingFrame(null)}
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              {startingFrame && (
                <img
                  src={startingFrame}
                  alt="Starting frame preview"
                  className="mt-3 max-h-40 rounded-lg border border-border/40 object-contain"
                />
              )}
            </div>

            <Button
              onClick={onGenerate}
              disabled={busy}
              className="w-full"
              size="lg"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Generate Video
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              Generative video provider is not yet connected. The interface is ready — connect a
              model provider to start producing clips.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/40 bg-background/60 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Generated Clips</h2>
          </div>
          {clips.length === 0 ? (
            <div className="flex h-[60%] min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border/40 p-10 text-center text-sm text-muted-foreground">
              <Film className="mb-3 h-10 w-10 text-primary/70" />
              <div className="font-medium text-foreground">No clips yet</div>
              <div className="mt-1 max-w-sm">
                Your generated videos will appear here. Each clip can be previewed, downloaded, and
                reused inside Adventures.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {clips.map((c) => (
                <figure
                  key={c.id}
                  className="overflow-hidden rounded-xl border border-border/40 bg-background/60"
                >
                  <video
                    src={c.url}
                    controls
                    loop
                    playsInline
                    className="aspect-video w-full bg-black object-cover"
                  />
                  <figcaption className="p-3 text-xs">
                    <div className="line-clamp-2 text-foreground">{c.prompt}</div>
                    <div className="mt-1 text-muted-foreground">
                      {c.aspect} · {c.duration}s · {c.resolution}
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
