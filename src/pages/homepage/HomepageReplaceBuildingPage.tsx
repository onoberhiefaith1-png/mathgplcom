import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Check, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import SettingsPanel from "@/components/gamebuilder/SettingsPanel";
import AssetLibraryModal, { type UrlPick } from "@/components/gamebuilder/AssetLibraryModal";
import { renderPathOf, uploadGameAsset } from "@/lib/games/assets";
import {
  defaultAnimation,
  defaultSlant,
  uid,
  type AssetKind,
  type CanvasElement,
  type GameAssetRow,
  type MediaSource,
  type MediaType,
} from "@/lib/games/types";
import BuildingVersionSelector, { useBuildingVersion } from "@/components/homepage/BuildingVersionSelector";
import { useHomepageConfig } from "@/lib/homepage/homepageConfig";

const makeBuilding = (
  path: string,
  source: MediaSource,
  mediaType: MediaType,
  assetId = "",
): CanvasElement => ({
  id: uid(),
  kind: "reward",
  assetId,
  mediaType,
  storagePath: path,
  source,
  x: 0.5,
  y: 0.5,
  scale: 0.55,
  z: 1,
  rotation: 0,
  opacity: 1,
  animation: defaultAnimation(),
  slant: defaultSlant(),
});

/**
 * Replace Building — the whole building becomes one uploaded asset.
 * The homepage stays untouched until "Apply Building" is pressed.
 */
const HomepageReplaceBuildingPage = () => {
  const { version, setVersion, configMode, canSwitch, seeding } = useBuildingVersion();
  const { config, save, ready, saving } = useHomepageConfig({ mode: configMode });
  const [building, setBuilding] = useState<CanvasElement | null>(null);
  const [library, setLibrary] = useState(false);
  const [kind, setKind] = useState<AssetKind>("reward");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ready) setBuilding(config.customBuilding ?? null);
  }, [ready, config.customBuilding]);

  const elements = useMemo(() => (building ? [building] : []), [building]);

  const pickUploaded = (asset: GameAssetRow) => {
    setBuilding(makeBuilding(renderPathOf(asset), "storage", asset.media_type, asset.id));
    setLibrary(false);
  };

  const pickUrl = (pick: UrlPick) => {
    setBuilding(makeBuilding(pick.src, "url", pick.mediaType));
    setLibrary(false);
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const asset = await uploadGameAsset(file, "reward", file.name);
      pickUploaded(asset);
      toast.success("Building uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!building?.storagePath) {
      toast.error("Upload or choose a building first");
      return;
    }
    await save({ buildingMode: "custom", customBuilding: building });
    toast.success("Building applied to your homepage");
  };

  const restore = async () => {
    await save({ buildingMode: "mathgpl" });
    toast.success("MathGPL building restored");
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Homepage
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Replace Building</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void restore()}>
            <RotateCcw className="mr-2 h-4 w-4" /> Restore MathGPL building
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void apply()}>
            <Check className="mr-2 h-4 w-4" /> Apply Building
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {canSwitch && (
            <BuildingVersionSelector version={version} onChange={setVersion} seeding={seeding} />
          )}
          <p className="text-sm text-muted-foreground">
            Upload a building (one image or one looping video), then position, size and preview it here.
            Your homepage keeps its current building until you press Apply Building.
          </p>
          <GameCanvas
            elements={elements}
            selectedId={building?.id ?? null}
            editable
            onSelect={() => undefined}
            onMove={(_, x, y) => setBuilding((b) => (b ? { ...b, x, y } : b))}
          />
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
              <Upload className="mr-2 h-4 w-4" /> {busy ? "Uploading…" : "Upload building"}
            </Button>
            <Button variant="outline" onClick={() => setLibrary(true)}>
              Choose building from Asset Library
            </Button>
          </div>
        </div>

        <aside className="rounded-2xl border border-border bg-card/50 p-4">
          <p className="mb-3 text-sm font-semibold">Building settings</p>
          <SettingsPanel
            element={building}
            onChange={(patch) => setBuilding((b) => (b ? { ...b, ...patch } : b))}
            onDelete={() => setBuilding(null)}
            onLayer={() => undefined}
          />
        </aside>
      </main>

      <AssetLibraryModal
        open={library}
        onOpenChange={setLibrary}
        kind={kind}
        onKindChange={setKind}
        onPickUploaded={pickUploaded}
        onPickUrl={pickUrl}
        onPickPreset={() => toast.info("Presets are for progress bars, not buildings")}
      />
    </div>
  );
};

export default HomepageReplaceBuildingPage;
