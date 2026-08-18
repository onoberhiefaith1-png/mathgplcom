// Add / Edit / Delete dialogs shared by all three levels of the official
// GPL Asset library. Delete always confirms and offers Deactivate instead.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GPL_SURFACES, SURFACE_LABEL, type GplAssetType, type GplSurface,
} from "@/lib/gpl/assetLibrary";

export interface FolderDraft {
  name: string;
  description: string;
  icon: string;
  image_url: string;
}

interface FolderDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  withIcon?: boolean;
  initial?: Partial<FolderDraft>;
  onSave: (draft: FolderDraft) => Promise<void>;
}

export const FolderDialog = ({
  open, onClose, title, withIcon, initial, onSave,
}: FolderDialogProps) => {
  const [draft, setDraft] = useState<FolderDraft>({
    name: "", description: "", icon: "", image_url: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft({
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      icon: initial?.icon ?? "",
      image_url: initial?.image_url ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={draft.name}
              autoFocus
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Rewards"
              className="mt-1 min-h-[44px]"
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={2}
              className="mt-1"
            />
          </div>
          {withIcon && (
            <div>
              <Label>Icon or emoji (optional)</Label>
              <Input
                value={draft.icon}
                onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
                placeholder="💎"
                className="mt-1 min-h-[44px]"
              />
            </div>
          )}
          <div>
            <Label>Cover image URL (optional)</Label>
            <Input
              value={draft.image_url}
              onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
              placeholder="https://…"
              className="mt-1 min-h-[44px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !draft.name.trim()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export interface AssetDraft {
  name: string;
  description: string;
  asset_type: GplAssetType;
  glyph: string;
  external_url: string;
  file: File | null;
  surfaces: GplSurface[];
}

const TYPES: { value: GplAssetType; label: string }[] = [
  { value: "image", label: "Image" },
  { value: "transparent", label: "Transparent PNG" },
  { value: "gif", label: "GIF" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "emoji", label: "Emoji" },
  { value: "model", label: "3D model" },
];

interface AssetDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initial?: Partial<AssetDraft>;
  onSave: (draft: AssetDraft) => Promise<void>;
}

export const AssetDialog = ({ open, onClose, title, initial, onSave }: AssetDialogProps) => {
  const [draft, setDraft] = useState<AssetDraft>({
    name: "", description: "", asset_type: "image", glyph: "",
    external_url: "", file: null, surfaces: [],
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft({
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      asset_type: initial?.asset_type ?? "image",
      glyph: initial?.glyph ?? "",
      external_url: initial?.external_url ?? "",
      file: null,
      surfaces: initial?.surfaces ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isEmoji = draft.asset_type === "emoji";
  const valid = draft.name.trim() && (!isEmoji || draft.glyph.trim());

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await onSave({ ...draft, name: draft.name.trim(), glyph: draft.glyph.trim() });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Official assets are available to every account once active.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={draft.name}
              autoFocus
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="mt-1 min-h-[44px]"
            />
          </div>
          <div>
            <Label>Type</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, asset_type: t.value }))}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
                    (draft.asset_type === t.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {isEmoji ? (
            <div>
              <Label>Emoji</Label>
              <Input
                value={draft.glyph}
                onChange={(e) => setDraft((d) => ({ ...d, glyph: e.target.value }))}
                placeholder="🐿️"
                className="mt-1 min-h-[44px] text-2xl"
              />
            </div>
          ) : (
            <>
              <div>
                <Label>Upload file</Label>
                <Input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, file: e.target.files?.[0] ?? null }))
                  }
                  className="mt-1 min-h-[44px]"
                />
              </div>
              <div>
                <Label>…or use an existing URL</Label>
                <Input
                  value={draft.external_url}
                  onChange={(e) => setDraft((d) => ({ ...d, external_url: e.target.value }))}
                  placeholder="/assets/rewards/diamond.png"
                  className="mt-1 min-h-[44px]"
                />
              </div>
            </>
          )}
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={2}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Used in</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {GPL_SURFACES.map((surface) => (
                <label key={surface} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.surfaces.includes(surface)}
                    onCheckedChange={(checked) =>
                      setDraft((d) => ({
                        ...d,
                        surfaces: checked
                          ? [...d.surfaces, surface]
                          : d.surfaces.filter((s) => s !== surface),
                      }))
                    }
                  />
                  {SURFACE_LABEL[surface]}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !valid}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  what: string;
  impact?: string;
  onDeactivate?: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export const DeleteDialog = ({
  open, onClose, what, impact, onDeactivate, onDelete,
}: DeleteDialogProps) => {
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {what}?</DialogTitle>
          <DialogDescription>
            {impact ?? "This cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          {onDeactivate && (
            <Button variant="secondary" disabled={busy} onClick={() => void run(onDeactivate)}>
              Deactivate instead
            </Button>
          )}
          <Button variant="destructive" disabled={busy} onClick={() => void run(onDelete)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
