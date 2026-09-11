import { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Check, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import AssetLibraryModal, { type UrlPick } from "@/components/gamebuilder/AssetLibraryModal";
import { uploadGameAsset, renderPathOf } from "@/lib/games/assets";
import type { AssetKind, GameAssetRow } from "@/lib/games/types";
import { useHomepageConfig, type HomepageMediaRef } from "@/lib/homepage/homepageConfig";
import BuildingVersionSelector, { useBuildingVersion } from "@/components/homepage/BuildingVersionSelector";
import { DEFAULT_BACKGROUND } from "@/lib/homepage/defaults";

/** Change Background — touches the background layer only. */
const HomepageBackgroundPage = () => {
  const { version, setVersion, configMode, canSwitch, seeding } = useBuildingVersion();
  // A background opened from a building's own Settings belongs to THAT building.
  const [params] = useSearchParams();
  const buildingId = params.get("building");
  const { config, save, ready, saving } = useHomepageConfig({ mode: configMode, buildingId });
  const [draft, setDraft] = useState<HomepageMediaRef | null>(null);
  const [library, setLibrary] = useState(false);
  const [kind, setKind] = useState<AssetKind>("background");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ready) setDraft(config.background ?? null);
  }, [ready, config.background]);

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
      toast.success("Background uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const [dirty, setDirty] = useState(false);

  const apply = async () => {
    try {
      await save({ background: draft });
      setDirty(false);
      toast.success("Background saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Homepage
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Change Background</h1>
        <div className="w-24" />
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 pb-16">
        {canSwitch && (
          <BuildingVersionSelector version={version} onChange={setVersion} seeding={seeding} />
        )}
        <p className="text-sm text-muted-foreground">
          This changes only the scene behind the building — image, animated image or looping video.
          The rotating building, every button and the whole interface stay exactly where they are.
        </p>

        <div className="overflow-hidden rounded-2xl border border-border bg-black">
          <div className="relative aspect-video w-full">
            {draft ? (
              <SignedMedia
                path={draft.path}
                source={draft.source}
                mediaType={draft.mediaType}
                fit="cover"
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <video
                src={DEFAULT_BACKGROUND.url}
                autoPlay
                muted
                loop
                playsInline
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-background/70 px-3 py-1 text-xs font-medium backdrop-blur">
                Building layer unchanged
              </span>
            </div>
          </div>
        </div>

        {dirty && (
          <p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
            Unsaved background change — press Save background to apply it.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
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
            <Upload className="mr-2 h-4 w-4" /> {busy ? "Uploading…" : "Upload background"}
          </Button>
          <Button variant="outline" onClick={() => setLibrary(true)}>
            Choose from Asset Library
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(null);
              setDirty(true);
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Restore default
          </Button>
          <Button disabled={saving} onClick={() => void apply()} className="ml-auto">
            <Check className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save background"}
          </Button>
        </div>
      </main>

      <AssetLibraryModal
        open={library}
        onOpenChange={setLibrary}
        kind={kind}
        onKindChange={setKind}
        onPickUploaded={pickUploaded}
        onPickUrl={pickUrl}
        onPickPreset={() => toast.info("Presets are for progress bars, not backgrounds")}
      />
    </div>
  );
};

export default HomepageBackgroundPage;
