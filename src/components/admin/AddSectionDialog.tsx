// Section library: pick one of the ready-made homepage blocks and name it.
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SECTION_TEMPLATES, type SiteSectionKind } from "@/lib/site/types";

const AddSectionDialog = ({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (value: { kind: SiteSectionKind; title: string }) => Promise<unknown>;
}) => {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<SiteSectionKind | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!kind) return;
    setBusy(true);
    try {
      await onCreate({ kind, title });
      toast.success("Section added — it stays hidden until you switch it on");
      setTitle("");
      setKind(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the section");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a section</DialogTitle>
          <DialogDescription>
            Name it, then choose a block. It's added at the bottom, hidden and empty, ready for your
            words, images and links.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Section name, e.g. Monetize your passion"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {SECTION_TEMPLATES.map((template) => {
            const active = kind === template.kind;
            return (
              <button
                key={template.kind}
                type="button"
                onClick={() => setKind(template.kind)}
                className={`rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card/60 hover:border-primary/50"
                }`}
              >
                <p className="text-sm font-semibold">{template.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {[
                    template.fields.eyebrow && "eyebrow",
                    template.fields.headline && "headline",
                    template.fields.subline && "supporting line",
                    template.fields.cta && "button + link",
                    template.fields.media && "image / video",
                    template.fields.items && `${template.defaultItems} panels`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "no fields"}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!kind || !title.trim() || busy} onClick={() => void create()}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add section
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddSectionDialog;
