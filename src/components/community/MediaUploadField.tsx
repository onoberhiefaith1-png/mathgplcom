/**
 * One upload card in the Community profile editor: a preview of what the
 * public profile will show, plus Upload / Replace / Remove. No links are
 * ever typed — the teacher uploads the file from this device.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";

import {
  removeCommunityMedia,
  uploadCommunityMedia,
  useCommunityMediaUrl,
  type CommunityMediaKind,
} from "@/lib/community/media";

type Shape = "round" | "banner" | "video";

const MediaUploadField = ({
  label,
  hint,
  kind,
  shape,
  accept,
  maxMb,
  value,
  isVideo,
  onUploaded,
  onCleared,
}: {
  label: string;
  hint?: string;
  kind: CommunityMediaKind;
  shape: Shape;
  accept: string;
  maxMb: number;
  value: string;
  /** For the cover: whether the current value should play as a video. */
  isVideo?: boolean;
  onUploaded: (path: string, file: File) => void;
  onCleared: () => void;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = useCommunityMediaUrl(value);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`That file is too large. Please choose one under ${maxMb} MB.`);
      return;
    }
    setBusy(true);
    try {
      const previous = value;
      const path = await uploadCommunityMedia(file, kind);
      onUploaded(path, file);
      if (previous) void removeCommunityMedia(previous);
      toast.success(`${label} uploaded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload that file.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const clear = () => {
    if (value) void removeCommunityMedia(value);
    onCleared();
  };

  const showsVideo = shape === "video" || (shape === "banner" && isVideo);

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {url ? (
          showsVideo ? (
            <video
              src={url}
              controls
              preload="metadata"
              className={
                shape === "video"
                  ? "w-full max-w-md rounded-xl border border-border"
                  : "h-28 w-full max-w-md rounded-xl border border-border object-cover"
              }
            />
          ) : (
            <img
              src={url}
              alt={label}
              className={
                shape === "round"
                  ? "h-20 w-20 rounded-full border border-border object-cover"
                  : "h-28 w-full max-w-md rounded-xl border border-border object-cover"
              }
            />
          )
        ) : (
          <div
            className={`grid place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground ${
              shape === "round" ? "h-20 w-20 rounded-full" : "h-28 w-full max-w-md"
            }`}
          >
            Nothing uploaded yet
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(event) => void choose(event.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </button>
          {value && !busy && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:bg-muted"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaUploadField;
