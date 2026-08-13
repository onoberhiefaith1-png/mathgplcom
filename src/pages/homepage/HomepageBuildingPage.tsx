import { useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, RotateCcw, Scissors, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import { renderPathOf, uploadGameAsset } from "@/lib/games/assets";
import { makeTransparent } from "@/lib/games/removeBackground";
import BuildingVersionSelector, { useBuildingVersion } from "@/components/homepage/BuildingVersionSelector";
import { BUILDING_SLOTS, type BuildingSlot } from "@/lib/homepage/buildingSlots";
import {
  resolveMediaUrl,
  useHomepageConfig,
  type HomepageMediaRef,
} from "@/lib/homepage/homepageConfig";

/**
 * Edit MathGPL Building — the original building only.
 * Each slot supports Replace Image and Remove Background. Geometry is preserved.
 */
const HomepageBuildingPage = () => {
  const { version, setVersion, configMode, canSwitch, seeding } = useBuildingVersion();
  const { config, save } = useHomepageConfig({ mode: configMode });
  const overrides = config.slotOverrides ?? {};
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [cutoutSlot, setCutoutSlot] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string | null>(null);

  const replace = async (slotId: string, file: File) => {
    setBusySlot(slotId);
    try {
      const asset = await uploadGameAsset(file, "background", `${slotId} artwork`);
      const ref: HomepageMediaRef = {
        path: renderPathOf(asset),
        source: "storage",
        mediaType: asset.media_type,
      };
      await save({ slotOverrides: { ...overrides, [slotId]: ref } });
      toast.success("Artwork replaced — position and shape kept");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Replace failed");
    } finally {
      setBusySlot(null);
    }
  };

  /** Cut the backdrop out of the artwork currently shown in this slot. */
  const removeBg = async (slot: BuildingSlot) => {
    setCutoutSlot(slot.id);
    try {
      const ref = overrides[slot.id];
      const url = ref ? await resolveMediaUrl(ref) : slot.defaultUrl;
      if (!url) throw new Error("Could not load this artwork");
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not load this artwork");
      const blob = await res.blob();
      const cut = await makeTransparent(
        new File([blob], `${slot.id}.png`, { type: blob.type || "image/png" }),
      );
      const asset = await uploadGameAsset(
        new File([cut], `${slot.id}-cutout.png`, { type: "image/png" }),
        "background",
        `${slot.id} artwork (cutout)`,
      );
      await save({
        slotOverrides: {
          ...overrides,
          [slot.id]: { path: renderPathOf(asset), source: "storage", mediaType: "image" },
        },
      });
      toast.success("Background removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Background removal failed");
    } finally {
      setCutoutSlot(null);
    }
  };

  const revert = async (slotId: string) => {
    const next = { ...overrides };
    delete next[slotId];
    await save({ slotOverrides: next });
    toast.success("Original artwork restored");
  };


  const Thumb = ({ slot }: { slot: BuildingSlot }) => {
    const ref = overrides[slot.id];
    if (!ref) {
      return <img src={slot.defaultUrl} alt={slot.label} className="h-full w-full object-contain" />;
    }
    return (
      <SignedMedia
        path={ref.path}
        source={ref.source}
        mediaType={ref.mediaType}
        fit="contain"
        className="h-full w-full"
      />
    );
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Homepage
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Edit MathGPL Building</h1>
        <div className="w-24" />
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 pb-16">
        {canSwitch && (
          <BuildingVersionSelector version={version} onChange={setVersion} seeding={seeding} />
        )}
        <p className="text-sm text-muted-foreground">
          The original MathGPL building is made of 16 artwork slots. The only action is
          Replace Image — position, curve, perspective, size and rotation are kept automatically.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            const slotId = targetRef.current;
            if (f && slotId) void replace(slotId, f);
            e.target.value = "";
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BUILDING_SLOTS.map((slot, i) => (
            <div key={slot.id} className="rounded-2xl border border-border bg-card/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">Image {i + 1}</p>
                <div className="flex items-center gap-1.5">
                  {overrides[slot.id] && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Replaced
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px]"
                    disabled={cutoutSlot === slot.id || busySlot === slot.id}
                    onClick={() => void removeBg(slot)}
                  >
                    <Scissors className="mr-1 h-3 w-3" />
                    {cutoutSlot === slot.id ? "Removing…" : "Remove background"}
                  </Button>
                </div>
              </div>

              <div className="h-28 w-full overflow-hidden rounded-lg bg-muted/30">
                <Thumb slot={slot} />
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground">{slot.label}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={busySlot === slot.id}
                  onClick={() => {
                    targetRef.current = slot.id;
                    inputRef.current?.click();
                  }}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {busySlot === slot.id ? "Replacing…" : "Replace Image"}
                </Button>
                {overrides[slot.id] && (
                  <Button size="sm" variant="ghost" onClick={() => void revert(slot.id)} aria-label="Revert">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default HomepageBuildingPage;
