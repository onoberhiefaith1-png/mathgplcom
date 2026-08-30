/**
 * SURFACE GALLERY — the built-in sample backgrounds for one building surface.
 *
 * Eight professional starting templates. Choosing one applies it to the
 * selected surface only (`builtin:<key>` texture path); the teacher can
 * replace it with their own upload at any time.
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SURFACE_SAMPLES } from "@/lib/building/gallery";

export interface SurfaceGalleryDialogProps {
  open: boolean;
  /** Surface display name, e.g. "Left wall". */
  title: string;
  onOpenChange: (open: boolean) => void;
  /** Called with the sample key when the teacher picks one. */
  onChoose: (sampleKey: string) => void;
}

export default function SurfaceGalleryDialog({
  open,
  title,
  onOpenChange,
  onChoose,
}: SurfaceGalleryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a template — {title}</DialogTitle>
          <DialogDescription>
            These samples are starting templates for this surface. They are fitted like a
            physical panel — never stretched — and you can replace them with your own image
            at any time.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SURFACE_SAMPLES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onChoose(s.key)}
              className="group overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-primary/60"
            >
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={s.url}
                  alt={`${s.label} sample background`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-2">
                <p className="text-xs font-semibold text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground">Style {s.style}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}