import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { uploadAcademiaMedia } from "@/lib/academia/api";
import { generateAcademiaThumbnail } from "@/lib/academia/thumbnail.functions";

type Ctx = { topic?: string; subtopic?: string; session?: string; task?: string };

/** Upload, capture a video frame, or generate a picture from the real teaching context. */
const ThumbnailPicker = ({
  open,
  onOpenChange,
  academiaId,
  label,
  context,
  videoUrl,
  onPicked,
  title = "Choose a picture",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  academiaId: string;
  label: string;
  context: Ctx;
  videoUrl?: string | null;
  onPicked: (path: string) => Promise<void> | void;
  title?: string;
}) => {
  const [busy, setBusy] = useState<null | "upload" | "frame" | "ai">(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const generate = useServerFn(generateAcademiaThumbnail);
  const direct = !!videoUrl && !/youtu|vimeo/.test(videoUrl);

  const done = async (path: string) => {
    await onPicked(path);
    onOpenChange(false);
    toast.success("Picture saved.");
  };
  const guard = async (kind: "upload" | "frame" | "ai", fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message || "That didn't work.");
    } finally {
      setBusy(null);
    }
  };

  const captureFrame = () =>
    guard("frame", async () => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) throw new Error("Play the video to the frame you want first.");
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("This video doesn't allow frame capture. Upload a picture instead.");
      await done(await uploadAcademiaMedia(academiaId, blob, `${label}-frame`));
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              guard("ai", async () => {
                const { path } = await generate({ data: { academiaId, label, ...context } });
                await done(path);
              })
            }
            className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-left text-sm hover:bg-primary/15"
          >
            {busy === "ai" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 text-primary" />}
            <span>
              <span className="block font-semibold">Generate with AI</span>
              <span className="block text-xs text-muted-foreground">
                Made from {[context.topic, context.subtopic, context.session, context.task].filter(Boolean).join(" · ") || "this item"}
              </span>
            </span>
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm hover:bg-muted"
          >
            {busy === "upload" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="font-semibold">Upload my own picture</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) guard("upload", async () => done(await uploadAcademiaMedia(academiaId, f, label)));
            }}
          />
          {direct && (
            <div className="rounded-xl border border-border p-3">
              <video ref={videoRef} src={videoUrl!} crossOrigin="anonymous" controls className="w-full rounded-lg" />
              <button
                type="button"
                disabled={!!busy}
                onClick={captureFrame}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                {busy === "frame" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Use this frame
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default ThumbnailPicker;
