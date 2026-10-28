// "Where would you like to get the image/video from?" — the one source menu
// used by both Import Image and Import Video. Purely a chooser: the caller owns
// the actual picking and the insertion.
import { createPortal } from "react-dom";
import { FolderOpen, Images, Puzzle, X } from "lucide-react";
import { useEscapeClose } from "@/hooks/useEscapeClose";

export type ImportSource = "gallery" | "file" | "mygpl";

interface Props {
  kind: "image" | "video";
  onPick: (source: ImportSource) => void;
  onClose: () => void;
}

export function ImportSourceDialog({ kind, onPick, onClose }: Props) {
  useEscapeClose(onClose);
  const noun = kind === "image" ? "image" : "video";
  const options: { key: ImportSource; icon: React.ReactNode; label: string; hint: string }[] = [
    {
      key: "gallery",
      icon: <Images className="h-4 w-4" />,
      label: "Gallery",
      hint: `Choose ${kind === "image" ? "an image" : "a video"} from your device.`,
    },
    {
      key: "file",
      icon: <FolderOpen className="h-4 w-4" />,
      label: "File",
      hint: "Browse files on your device.",
    },
    {
      key: "mygpl",
      icon: <Puzzle className="h-4 w-4" />,
      label: "MyGPL",
      hint: "Choose from your MyGPL library.",
    },
  ];

  return createPortal(
    <div
      data-slide-chrome="true"
      className="fixed inset-0 z-[9998] grid place-items-center bg-slate-950/50 p-4"
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-background p-4 shadow-xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">
              Import {kind === "image" ? "Image" : "Video"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Where would you like to get the {noun} from?
            </p>
          </div>
          <button type="button" className="rounded p-1 hover:bg-muted" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-1.5">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => onPick(o.key)}
              className="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left hover:bg-muted"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
                {o.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ImportSourceDialog;
