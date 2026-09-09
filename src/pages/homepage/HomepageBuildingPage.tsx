import { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Check, Gauge, RotateCcw, Scissors, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import { renderPathOf, uploadGameAsset } from "@/lib/games/assets";
import { makeTransparent } from "@/lib/games/removeBackground";
import BuildingVersionSelector, { useBuildingVersion } from "@/components/homepage/BuildingVersionSelector";
import {
  CORE_SLOTS,
  RING_SLOTS,
  slotsForVersion,
  type BuildingSlot,
} from "@/lib/homepage/buildingSlots";
import {
  clampBuildingSpeed,
  resolveMediaUrl,
  sliderToSpeed,
  speedToSlider,
  useHomepageConfig,
  type HomepageMediaRef,
} from "@/lib/homepage/homepageConfig";

/**
 * Edit MathGPL Building — the original building only.
 * Each slot supports Replace Image and Remove Background. Geometry is preserved.
 * Rotation speed lives here too: one slider, saved with the artwork.
 */
const HomepageBuildingPage = () => {
  const { version, setVersion, configMode, canSwitch, seeding } = useBuildingVersion();
  const { config, save, ready, saving } = useHomepageConfig({ mode: configMode });
  // Pro and Free are separate pages with their own default artwork.
  const slots = slotsForVersion(version);
  // Draft artwork. Nothing reaches the building until Save is pressed.
  const [draft, setDraft] = useState<Record<string, HomepageMediaRef>>({});
  const [speed, setSpeed] = useState(1);
  const [dirty, setDirty] = useState(false);
  const overrides = draft;

  /**
   * MASTER IMAGES — the fast start. Two pictures, one for the eight outer
   * positions and one for the eight inner ones, are copied into all sixteen
   * slots as ordinary independent images. Afterwards every position is still
   * edited on its own.
   */
  const [masterOpen, setMasterOpen] = useState(false);
  const [masterOuter, setMasterOuter] = useState<HomepageMediaRef | null>(null);
  const [masterInner, setMasterInner] = useState<HomepageMediaRef | null>(null);
  const [masterBusy, setMasterBusy] = useState<"outer" | "inner" | null>(null);
  const [cutMaster, setCutMaster] = useState(true);
  const masterInputRef = useRef<HTMLInputElement>(null);
  const masterTargetRef = useRef<"outer" | "inner" | null>(null);

  useEffect(() => {
    if (!ready) return;
    const saved = config.slotOverrides ?? {};
    setDraft(saved);
    setSpeed(clampBuildingSpeed(config.buildingSpeed));
    setDirty(false);
    // First time in: ask for the two master pictures instead of sixteen.
    setMasterOpen(Object.keys(saved).length === 0);
  }, [ready, configMode, config.slotOverrides, config.buildingSpeed]);

  const stage = (next: Record<string, HomepageMediaRef>) => {
    setDraft(next);
    setDirty(true);
  };

  const stageSpeed = (next: number) => {
    setSpeed(clampBuildingSpeed(next));
    setDirty(true);
  };

  const saveNow = async () => {
    try {
      await save({ slotOverrides: draft, buildingSpeed: clampBuildingSpeed(speed) });
      setDirty(false);
      toast.success(version === "free" ? "Free building saved" : "Pro building saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

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
      stage({ ...overrides, [slotId]: ref });
      toast.success("Artwork replaced — press Save to apply it");
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
      stage({
        ...overrides,
        [slot.id]: { path: renderPathOf(asset), source: "storage", mediaType: "image" },
      });
      toast.success("Background removed — press Save to apply it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Background removal failed");
    } finally {
      setCutoutSlot(null);
    }
  };

  const revert = (slotId: string) => {
    const next = { ...overrides };
    delete next[slotId];
    stage(next);
  };

  /** Upload one master picture, optionally with its background cut out. */
  const uploadMaster = async (which: "outer" | "inner", file: File) => {
    setMasterBusy(which);
    try {
      let source = file;
      if (cutMaster) {
        const cut = await makeTransparent(file);
        source = new File([cut], `${which}-master.png`, { type: "image/png" });
      }
      const asset = await uploadGameAsset(source, "background", `${which} building master image`);
      const ref: HomepageMediaRef = {
        path: renderPathOf(asset),
        source: "storage",
        mediaType: cutMaster ? "image" : asset.media_type,
      };
      if (which === "outer") setMasterOuter(ref);
      else setMasterInner(ref);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setMasterBusy(null);
    }
  };

  /** Copy the outer master into the 8 upper positions, the inner into the 8 lower. */
  const applyMasters = () => {
    const next = { ...overrides };
    if (masterOuter) RING_SLOTS.forEach((s) => (next[s.id] = masterOuter));
    if (masterInner) CORE_SLOTS.forEach((s) => (next[s.id] = masterInner));
    stage(next);
    setMasterOpen(false);
    toast.success("All sixteen positions filled — each one can still be changed on its own");
  };

  const MasterCard = ({
    which,
    label,
    hint,
    media: mediaRef,
  }: {
    which: "outer" | "inner";
    label: string;
    hint: string;
    media: HomepageMediaRef | null;
  }) => (
    <div className="rounded-2xl border border-border bg-card/50 p-3">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mb-2 text-[11px] text-muted-foreground">{hint}</p>
      <div className="h-32 w-full overflow-hidden rounded-lg bg-muted/30">
        {mediaRef ? (
          <SignedMedia
            path={mediaRef.path}
            source={mediaRef.source}
            mediaType={mediaRef.mediaType}
            fit="contain"
            className="h-full w-full"
          />
        ) : (
          <div className="grid h-full place-items-center px-4 text-center text-xs text-muted-foreground">
            No picture yet
          </div>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="mt-2 w-full"
        disabled={masterBusy === which}
        onClick={() => {
          masterTargetRef.current = which;
          masterInputRef.current?.click();
        }}
      >
        <Upload className="mr-1.5 h-3.5 w-3.5" />
        {masterBusy === which ? "Uploading…" : mediaRef ? "Change picture" : "Choose picture"}
      </Button>
    </div>
  );



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
        <h1 className="text-lg font-semibold tracking-wide">
          {version === "free" ? "Edit Free Building" : "Edit Pro Building"}
        </h1>
        <Button size="sm" disabled={saving} onClick={() => void saveNow()}>
          <Check className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save building"}
        </Button>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 pb-16">
        {canSwitch && (
          <BuildingVersionSelector version={version} onChange={setVersion} seeding={seeding} />
        )}
        <p className="text-sm text-muted-foreground">
          The original MathGPL building is made of 16 artwork slots. The only action is
          Replace Image — position, curve, perspective, size and rotation are kept automatically.
        </p>

        <section className="rounded-2xl border border-border bg-card/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Building Speed</p>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                {speed}x
              </span>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => stageSpeed(1)}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset to normal
            </Button>
          </div>
          <Slider
            className="mt-4"
            value={[speedToSlider(speed)]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([pos]) => stageSpeed(sliderToSpeed(pos ?? 0.5))}
            aria-label="Building rotation speed"
          />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>Very slow</span>
            <span>Normal</span>
            <span>Very fast</span>
          </div>
        </section>

        {dirty && (
          <p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
            Unsaved changes — press Save building to apply them to the homepage.
          </p>
        )}


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

        <input
          ref={masterInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            const which = masterTargetRef.current;
            if (f && which) void uploadMaster(which, f);
            e.target.value = "";
          }}
        />

        {masterOpen ? (
          <section className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div>
              <h2 className="text-sm font-semibold">Start with two pictures</h2>
              <p className="text-[11px] text-muted-foreground">
                One picture for the outer building and one for the inner building. Continue fills all
                sixteen positions, and every position can still be changed on its own afterwards.
              </p>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={cutMaster}
                onChange={(e) => setCutMaster(e.target.checked)}
              />
              Remove the background of the pictures I choose
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <MasterCard
                which="outer"
                label="Outer Building Image"
                hint="Fills the eight upper positions."
                media={masterOuter}
              />
              <MasterCard
                which="inner"
                label="Inner Building Image"
                hint="Fills the eight lower positions."
                media={masterInner}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!masterOuter && !masterInner}
                onClick={applyMasters}
              >
                <Check className="mr-1.5 h-4 w-4" /> Continue
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMasterOpen(false)}>
                Skip — edit the sixteen positions myself
              </Button>
            </div>
          </section>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={() => setMasterOpen(true)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Edit master images
          </Button>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {slots.map((slot, i) => (
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
                    {cutoutSlot === slot.id ? "Re-cutting…" : "Re-cut background"}
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
                  <Button size="sm" variant="ghost" onClick={() => revert(slot.id)} aria-label="Revert">
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
