import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Check, Eraser, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import SettingsPanel from "@/components/gamebuilder/SettingsPanel";
import AssetLibraryModal, { type UrlPick } from "@/components/gamebuilder/AssetLibraryModal";
import { renderPathOf, uploadGameAsset } from "@/lib/games/assets";
import { makeTransparent } from "@/lib/games/removeBackground";
import { getSignedUrl } from "@/lib/games/urls";
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
import {
  clampBuildingSpeed,
  sliderToSpeed,
  speedToSlider,
  useHomepageConfig,
} from "@/lib/homepage/homepageConfig";

const SPEED_PRESETS = [0.1, 0.25, 0.5, 1, 2, 5, 10];


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
  const [speed, setSpeed] = useState(1);
  const [library, setLibrary] = useState(false);
  const [assetKind, setAssetKind] = useState<AssetKind>("reward");
  const [busy, setBusy] = useState(false);
  const [cutting, setCutting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    setBuilding(config.buildingMode === "custom" ? config.customBuilding ?? null : null);
  }, [ready, config.buildingMode, config.customBuilding]);

  useEffect(() => {
    if (ready) setSpeed(clampBuildingSpeed(config.buildingSpeed));
  }, [ready, config.buildingSpeed]);

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

  /** Cut the backdrop out of the building currently on the preview. */
  const removeBg = async () => {
    if (!building) {
      toast.error("Choose an image building first");
      return;
    }
    if (building.mediaType !== "image") {
      toast.info("Videos use the chroma-key switch in Building settings");
      return;
    }
    setCutting(true);
    try {
      const url =
        building.source === "url"
          ? building.storagePath
          : await getSignedUrl(building.storagePath);
      if (!url) throw new Error("Could not load this building");
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not load this building");
      const blob = await res.blob();
      const cut = await makeTransparent(
        new File([blob], "building.png", { type: blob.type || "image/png" }),
      );
      const asset = await uploadGameAsset(
        new File([cut], "building-cutout.png", { type: "image/png" }),
        "background",
        "Building (cutout)",
      );
      // Keep the authored transform — only the artwork becomes transparent.
      setBuilding((b) =>
        b
          ? {
              ...b,
              assetId: asset.id,
              storagePath: renderPathOf(asset),
              source: "storage",
              mediaType: "image",
              blend: "normal",
              bgRemoval: "none",
              keyColor: undefined,
              keyTolerance: undefined,
            }
          : b,
      );
      toast.success("Background removed — press Save Building to apply it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Background removal failed");
    } finally {
      setCutting(false);
    }
  };

  const apply = async () => {
    if (!building?.storagePath) {
      toast.error("Upload or choose a building first");
      return;
    }
    try {
      await save({
        buildingMode: "custom",
        customBuilding: building,
        buildingSpeed: clampBuildingSpeed(speed),
      });
      toast.success("Building saved to your homepage");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };


  const restore = async () => {
    try {
      await save({ buildingMode: "mathgpl", buildingSpeed: clampBuildingSpeed(speed) });
      setBuilding(null);
      toast.success("MathGPL building restored");
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
        <h1 className="text-lg font-semibold tracking-wide">Replace Building</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void restore()}>
            <RotateCcw className="mr-2 h-4 w-4" /> Switch to MathGPL building
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void apply()}>
            <Check className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save Building"}
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
            Your homepage keeps its current building until you press Save Building.
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
              Choose from MathGPL Assets
            </Button>
            <Button
              variant="outline"
              disabled={cutting}
              onClick={() => void removeBg()}
              title={
                building && building.mediaType !== "image"
                  ? "Videos use the chroma-key switch in Building settings"
                  : "Cut the backdrop out of this building"
              }
            >
              <Eraser className="mr-2 h-4 w-4" /> {cutting ? "Removing…" : "Remove background"}
            </Button>
          </div>
        </div>

        <aside className="space-y-4 rounded-2xl border border-border bg-card/50 p-4">
          <p className="text-sm font-semibold">Building settings</p>

          <div className="rounded-xl border border-border bg-background/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Speed
              </span>
              <span className="text-sm font-semibold">{speed.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={speedToSlider(speed)}
              onChange={(e) => setSpeed(sliderToSpeed(Number(e.target.value)))}
              aria-label="Building speed"
              className="w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>0.1× slower</span>
              <span>1× normal</span>
              <span>10× faster</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SPEED_PRESETS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={Math.abs(speed - p) < 0.01 ? "default" : "outline"}
                  onClick={() => setSpeed(p)}
                >
                  {p}×
                </Button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              1× is the building's own natural speed — video playback for a replaced building,
              rotation for the MathGPL building.
            </p>
          </div>

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
        kind={assetKind}
        onKindChange={setAssetKind}
        onPickUploaded={pickUploaded}
        onPickUrl={pickUrl}
        onPickPreset={() => toast.info("Progress bar presets cannot be used as the homepage building")}
        title="Choose from MathGPL Assets"
        initialCatalogCategory={null}
        myGplKind="any"
        pickGplImmediately
      />
    </div>
  );
};

export default HomepageReplaceBuildingPage;
