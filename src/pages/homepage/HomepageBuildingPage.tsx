import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "@/lib/router-compat";
import { ArrowLeft, Check, Gauge, RotateCcw, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import { renderPathOf, uploadGameAsset } from "@/lib/games/assets";
import TransparencyCleanupDialog, {
  CLEAN_TRANSPARENCY_HINT,
  type CleanupChoice,
} from "@/components/homepage/TransparencyCleanupDialog";
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
import { useResolvedBuilding } from "@/lib/homepage/useResolvedBuilding";

interface ReviewRequest {
  blob: Blob;
  title: string;
  apply: (blob: Blob, choice: CleanupChoice) => Promise<void>;
}

/**
 * Edit Mathemagine Building — the original building only.
 * Each slot supports Replace Image and Clean transparency (with an opaque
 * background removal fallback inside the review). Geometry is preserved.
 * Rotation speed lives here too: one slider, saved with the artwork.
 */
const HomepageBuildingPage = () => {
  const { version, setVersion, configMode, canSwitch, seeding } = useBuildingVersion();
  // Opened from a building's own Settings: the outside of THAT building.
  const [params] = useSearchParams();
  const paramBuildingId = params.get("building");
  const resolved = useResolvedBuilding({
    adminPreview: version === "free" ? "free" : null,
    enabled: !paramBuildingId,
  });
  // A URL id edits that building. Otherwise edit the explicit selection only,
  // so a teacher who still sees the owner's building cannot overwrite it.
  const buildingId =
    paramBuildingId ??
    (resolved.explicit && (resolved.source === "workspace" || resolved.isAdmin)
      ? resolved.buildingId
      : null);
  const { config, save, ready, saving } = useHomepageConfig({
    mode: configMode,
    buildingId,
    disabled: !buildingId,
  });
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

  /**
   * Review step for every cleanup. Nothing is uploaded or staged until the
   * person picks a version AND that upload succeeds; the original stays put.
   */
  const [review, setReview] = useState<ReviewRequest | null>(null);

  const fetchBlob = async (url: string | null | undefined, what: string) => {
    if (!url) throw new Error(`Could not load ${what}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${what}`);
    return res.blob();
  };

  const uploadPng = async (blob: Blob, name: string, label: string): Promise<HomepageMediaRef> => {
    const asset = await uploadGameAsset(new File([blob], name, { type: "image/png" }), "background", label);
    return { path: renderPathOf(asset), source: "storage", mediaType: "image" };
  };

  /** Clean the transparency of the artwork currently shown in this slot. */
  const removeBg = async (slot: BuildingSlot) => {
    setCutoutSlot(slot.id);
    try {
      const ref = overrides[slot.id];
      const blob = await fetchBlob(ref ? await resolveMediaUrl(ref) : slot.defaultUrl, "this artwork");
      setReview({
        blob,
        title: `Clean transparency — ${slot.label}`,
        apply: async (chosen: Blob, choice: CleanupChoice) => {
          if (choice !== "original") {
            const next = await uploadPng(chosen, `${slot.id}-clean.png`, `${slot.id} artwork (clean transparency)`);
            stage({ ...overrides, [slot.id]: next });
            toast.success("Transparency cleaned — press Save to apply it");
          }
          setReview(null);
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load this artwork");
    } finally {
      setCutoutSlot(null);
    }
  };

  const revert = (slotId: string) => {
    const next = { ...overrides };
    delete next[slotId];
    stage(next);
  };

  const setMaster = (which: "outer" | "inner", ref: HomepageMediaRef) =>
    which === "outer" ? setMasterOuter(ref) : setMasterInner(ref);

  /** Upload one master picture, optionally after a Clean transparency review. */
  const uploadMaster = async (which: "outer" | "inner", file: File) => {
    const uploadOriginal = async () => {
      const asset = await uploadGameAsset(file, "background", `${which} building master image`);
      setMaster(which, { path: renderPathOf(asset), source: "storage", mediaType: asset.media_type });
    };
    if (cutMaster && file.type.startsWith("image/")) {
      setReview({
        blob: file,
        title: which === "outer" ? "Clean transparency — outer building" : "Clean transparency — inner building",
        apply: async (chosen: Blob, choice: CleanupChoice) => {
          setMasterBusy(which);
          try {
            if (choice === "original") await uploadOriginal();
            else setMaster(which, await uploadPng(chosen, `${which}-master.png`, `${which} building master image`));
            setReview(null);
          } finally {
            setMasterBusy(null);
          }
        },
      });
      return;
    }
    setMasterBusy(which);
    try {
      await uploadOriginal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setMasterBusy(null);
    }
  };

  /** Clean the master currently shown, without applying it to any slot yet. */
  const removeMasterBg = async (which: "outer" | "inner") => {
    const current = which === "outer" ? masterOuter : masterInner;
    if (!current) return;
    try {
      const blob = await fetchBlob(await resolveMediaUrl(current), "this master image");
      setReview({
        blob,
        title: "Clean transparency — master image",
        apply: async (chosen: Blob, choice: CleanupChoice) => {
          if (choice !== "original") {
            setMaster(which, await uploadPng(chosen, `${which}-master-clean.png`, `${which} building master image (clean transparency)`));
            toast.success("Master image transparency cleaned");
          }
          setReview(null);
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load this master image");
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
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={masterBusy === which}
          onClick={() => {
            masterTargetRef.current = which;
            masterInputRef.current?.click();
          }}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {mediaRef ? "Replace" : "Choose"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={!mediaRef || masterBusy === which}
          onClick={() => void removeMasterBg(which)}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {masterBusy === which ? "Working…" : "Clean transparency"}
        </Button>
      </div>
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

  if (!paramBuildingId && resolved.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center text-muted-foreground">
        <p className="text-sm">Opening the building…</p>
      </main>
    );
  }

  if (!buildingId) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-xl place-items-center px-6 text-foreground">
        <div className="rounded-2xl border border-border bg-card/60 p-6 text-center">
          <h1 className="text-lg font-semibold">
            {version === "free" ? "Choose the Free building" : "Choose your building"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {version === "free"
              ? "Free accounts see the building you select here. Picking another one, including an older one, replaces it straight away."
              : "Until you choose one, people see Mathemagine’s building. The one you choose is the one they see."}
          </p>
          {canSwitch && (
            <div className="mt-4">
              <BuildingVersionSelector version={version} onChange={setVersion} seeding={seeding} />
            </div>
          )}
          <Link
            to={version === "free" ? "/buildings?tier=free" : "/buildings"}
            className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Choose a building
          </Link>
        </div>
      </main>
    );
  }

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
        {canSwitch && !buildingId && (
          <BuildingVersionSelector version={version} onChange={setVersion} seeding={seeding} />
        )}
        <p className="text-sm text-muted-foreground">
          The original Mathemagine building is made of 16 artwork slots. The only action is
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
              Clean transparency of the pictures I choose
            </label>
            <p className="-mt-2 text-[11px] text-muted-foreground">{CLEAN_TRANSPARENCY_HINT}</p>
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
                    title={CLEAN_TRANSPARENCY_HINT}
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    {cutoutSlot === slot.id ? "Opening…" : "Clean transparency"}
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
      <TransparencyCleanupDialog
        source={review?.blob ?? null}
        title={review?.title}
        onCancel={() => setReview(null)}
        onUse={(blob, choice) => (review ? review.apply(blob, choice) : Promise.resolve())}
      />
    </div>
  );
};

export default HomepageBuildingPage;
