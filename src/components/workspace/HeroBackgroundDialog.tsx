/**
 * Change background — the workspace dashboard hero.
 *
 * The teacher uploads or picks an image or a video, previews it in the real
 * hero shape and saves it to this workspace. It is stored as its own setting,
 * so it never touches the rotating-building background and has nothing to do
 * with the profile picture.
 */
import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import AssetLibraryModal, { type UrlPick } from "@/components/gamebuilder/AssetLibraryModal";
import { uploadGameAsset, renderPathOf } from "@/lib/games/assets";
import type { AssetKind, GameAssetRow } from "@/lib/games/types";
import { useHomepageConfig, type HomepageMediaRef } from "@/lib/homepage/homepageConfig";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the hero currently shows when no hero background has been chosen. */
  fallbackUrl: string | null;
  fallbackKind: "image" | "video";
};

const HeroBackgroundDialog = ({ open, onOpenChange, fallbackUrl, fallbackKind }: Props) => {
  const { config, save, ready, saving } = useHomepageConfig({ mode: "self" });
  const [draft, setDraft] = useState<HomepageMediaRef | null>(null);
  const [dirty, setDirty] = useState(false);
  const [library, setLibrary] = useState(false);
  const [kind, setKind] = useState<AssetKind>("background");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Every time the dialog opens it starts from what is actually saved.
  useEffect(() => {
    if (open && ready) {
      setDraft(config.heroBackground ?? null);
      setDirty(false);
    }
  }, [open, ready, config.heroBackground]);

  const pickUploaded = (asset: GameAssetRow) => {
    setDraft({ path: renderPathOf(asset), source: "storage", mediaType: asset.media_type });
    setDirty(true);
    setLibrary(false);
  };

  const pickUrl = (pick: UrlPick) => {
    setDraft({ path: pick.src, source: "url", mediaType: pick.mediaType });
    setDirty(true);
    setLibrary(false);
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const asset = await uploadGameAsset(file, "background", file.name);
      pickUploaded(asset);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    try {
      await save({ heroBackground: draft });
      setDirty(false);
      toast.success("Workspace background saved");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change background</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Use an image or a video behind your greeting. It belongs to this workspace only —
            your profile picture and the building scene stay exactly as they are.
          </p>

          <div className="overflow-hidden rounded-2xl border border-border bg-black">
            <div className="relative h-40 w-full sm:h-48">
              {draft ? (
                <SignedMedia
                  path={draft.path}
                  source={draft.source}
                  mediaType={draft.mediaType}
                  fit="cover"
                  className="absolute inset-0 h-full w-full"
                />
              ) : fallbackUrl ? (
                fallbackKind === "video" ? (
                  <video
                    src={fallbackUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    aria-hidden
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <img src={fallbackUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
              <span className="absolute bottom-4 left-5 text-lg font-semibold">Good evening!</span>
            </div>
          </div>

          {dirty && (
            <p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
              Unsaved change — press Save background to apply it.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> {busy ? "Uploading…" : "Upload image or video"}
            </Button>
            <Button variant="outline" onClick={() => setLibrary(true)}>
              Choose from library
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(null);
                setDirty(true);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset to default
            </Button>
            <Button disabled={saving || !dirty} onClick={() => void apply()} className="ml-auto">
              <Check className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save background"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AssetLibraryModal
        open={library}
        onOpenChange={setLibrary}
        kind={kind}
        onKindChange={setKind}
        onPickUploaded={pickUploaded}
        onPickUrl={pickUrl}
        onPickPreset={() => toast.info("Presets are for progress bars, not backgrounds")}
        title="Choose a background"
        myGplKind="any"
      />
    </>
  );
};

export default HeroBackgroundDialog;
