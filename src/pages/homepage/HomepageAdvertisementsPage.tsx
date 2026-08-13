import { useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Check, Eye, Lock, Monitor, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import { renderPathOf, uploadGameAsset } from "@/lib/games/assets";
import { useAccount } from "@/lib/accounts/useAccount";
import {
  AD_KINDS,
  AD_KIND_LABEL,
  AD_PROVIDERS,
  AD_PROVIDER_LABEL,
  AD_SLOTS,
  isScheduled,
  resolveCreative,
  useAdvertisements,
  type AdKind,
  type AdProvider,
  type AdvertisementRow,
} from "@/lib/homepage/advertisements";

/**
 * The platform's 8 advertisement slots.
 *
 * Advertisements exist ONLY here and play ONLY on the platform advertising
 * building's billboard (the Free building and Community). Nothing else in the
 * application shows ads. Slot N is permanently wired to outer building
 * position N — changing an advertisement never needs a code change.
 */
const HomepageAdvertisementsPage = () => {
  const { isPlatformOwner, isLoading } = useAccount();
  const { ads, upsert, patch, remove, refetch } = useAdvertisements();
  const [savingAll, setSavingAll] = useState(false);

  /** Force every pending field edit to commit, then confirm from the database. */
  const saveAll = async () => {
    setSavingAll(true);
    try {
      (document.activeElement as HTMLElement | null)?.blur();
      await new Promise((r) => setTimeout(r, 50));
      await refetch();
      toast.success("Advertisements saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingAll(false);
    }
  };
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [previewSlot, setPreviewSlot] = useState<number | null>(null);
  const [buildingPreview, setBuildingPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetSlot = useRef<number | null>(null);

  if (!isLoading && !isPlatformOwner) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-xl place-items-center px-6 text-foreground">
        <div className="rounded-2xl border border-border bg-card/60 p-6 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-lg font-semibold">Advertisements are managed by MathGPL</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only the platform can place advertisements on the advertising building.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to the building
          </Link>
        </div>
      </main>
    );
  }

  const upload = async (slot: number, file: File) => {
    setBusySlot(slot);
    try {
      const asset = await uploadGameAsset(file, "background", `Advertisement ${slot}`);
      await upsert.mutateAsync({
        slot,
        media_path: renderPathOf(asset),
        media_source: "storage",
        media_type: asset.media_type,
        provider: "manual",
      });
      toast.success(`Advertisement ${slot} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusySlot(null);
    }
  };

  const statusOf = (ad: AdvertisementRow) => {
    if (!ad.is_active) return { label: "Inactive", tone: "text-muted-foreground" };
    if (!isScheduled(ad)) return { label: "Scheduled", tone: "text-amber-500" };
    if (!resolveCreative(ad)) return { label: "Awaiting provider", tone: "text-amber-500" };
    return { label: "Active", tone: "text-emerald-500" };
  };

  const previewAd = ads.find((a) => a.slot === previewSlot) ?? null;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Platform console
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Advertisement Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setBuildingPreview(true)}>
            <Monitor className="mr-1.5 h-3.5 w-3.5" /> Live building preview
          </Button>
          <Button size="sm" disabled={savingAll} onClick={() => void saveAll()}>
            <Check className="mr-1.5 h-3.5 w-3.5" /> {savingAll ? "Saving…" : "Save advertisements"}
          </Button>
        </div>

      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 pb-16">
        <p className="text-sm text-muted-foreground">
          Each slot permanently owns one of the eight outer positions of the advertising building
          (slot 1 → position 1, slot 2 → position 2, and so on). As a position turns toward the
          viewer its advertisement appears on the central billboard: an image holds for its display
          duration, while a video holds the building still until it has played to the end. Empty,
          inactive or out-of-schedule slots keep the building's own artwork and never interrupt the
          rotation.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            const slot = targetSlot.current;
            if (f && slot) void upload(slot, f);
            e.target.value = "";
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {AD_SLOTS.map((slot) => {
            const ad = ads.find((a) => a.slot === slot);
            const status = ad ? statusOf(ad) : null;
            return (
              <div key={slot} className="rounded-2xl border border-border bg-card/50 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Advertisement slot {slot}</p>
                    <p className="text-xs text-muted-foreground">Building position {slot} · fixed</p>
                  </div>
                  {ad && status && (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${status.tone}`}>{status.label}</span>
                      <Switch
                        aria-label={`Activate advertisement ${slot}`}
                        checked={ad.is_active}
                        onCheckedChange={(v) => void patch.mutateAsync({ slot, is_active: v })}
                      />
                    </div>
                  )}
                </div>

                <div className="h-36 w-full overflow-hidden rounded-lg bg-black">
                  {ad?.ad_kind === "adsense" ? (
                    <div className="grid h-full place-items-center px-3 text-center text-xs text-muted-foreground">
                      {ad.adsense_slot_id
                        ? `Google AdSense · unit ${ad.adsense_slot_id}`
                        : "Google AdSense · add the ad-unit ID"}
                    </div>
                  ) : ad?.media_path ? (
                    <SignedMedia
                      path={ad.media_path}
                      source={ad.media_source}
                      mediaType={ad.media_type}
                      fit="contain"
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">
                      Empty slot
                    </div>
                  )}
                </div>

                {ad && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border px-2 py-0.5 uppercase tracking-wide">
                        {ad.media_type}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {AD_PROVIDER_LABEL[ad.provider]}
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-muted-foreground" htmlFor={`campaign-${slot}`}>
                          Campaign
                        </label>
                        <Input
                          id={`campaign-${slot}`}
                          className="h-8"
                          defaultValue={ad.campaign_name ?? ""}
                          placeholder="Optional name"
                          onBlur={(e) =>
                            void patch.mutateAsync({ slot, campaign_name: e.target.value || null })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground" htmlFor={`kind-${slot}`}>
                          Board content
                        </label>
                        <Select
                          value={ad.ad_kind}
                          onValueChange={(v) => void patch.mutateAsync({ slot, ad_kind: v as AdKind })}
                        >
                          <SelectTrigger id={`kind-${slot}`} className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AD_KINDS.map((k) => (
                              <SelectItem key={k} value={k}>
                                {AD_KIND_LABEL[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {ad.ad_kind === "adsense" && (
                        <div>
                          <label className="text-xs text-muted-foreground" htmlFor={`adsense-${slot}`}>
                            AdSense ad-unit ID
                          </label>
                          <Input
                            id={`adsense-${slot}`}
                            className="h-8"
                            defaultValue={ad.adsense_slot_id ?? ""}
                            placeholder="e.g. 1234567890"
                            onBlur={(e) =>
                              void patch.mutateAsync({
                                slot,
                                adsense_slot_id: e.target.value.trim() || null,
                              })
                            }
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-muted-foreground" htmlFor={`provider-${slot}`}>
                          Provider
                        </label>
                        <Select
                          value={ad.provider}
                          onValueChange={(v) =>
                            void patch.mutateAsync({ slot, provider: v as AdProvider })
                          }
                        >
                          <SelectTrigger id={`provider-${slot}`} className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AD_PROVIDERS.map((p) => (
                              <SelectItem key={p} value={p}>
                                {AD_PROVIDER_LABEL[p]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground" htmlFor={`starts-${slot}`}>
                          Starts
                        </label>
                        <Input
                          id={`starts-${slot}`}
                          type="date"
                          className="h-8"
                          defaultValue={ad.starts_at ? ad.starts_at.slice(0, 10) : ""}
                          onBlur={(e) =>
                            void patch.mutateAsync({
                              slot,
                              starts_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground" htmlFor={`ends-${slot}`}>
                          Ends
                        </label>
                        <Input
                          id={`ends-${slot}`}
                          type="date"
                          className="h-8"
                          defaultValue={ad.ends_at ? ad.ends_at.slice(0, 10) : ""}
                          onBlur={(e) =>
                            void patch.mutateAsync({
                              slot,
                              ends_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground" htmlFor={`dur-${slot}`}>
                        Seconds on screen
                      </label>
                      <Input
                        id={`dur-${slot}`}
                        type="number"
                        min={2}
                        max={60}
                        className="h-8 w-20"
                        defaultValue={Math.round((ad.duration_ms || 6000) / 1000)}
                        disabled={ad.media_type === "video"}
                        onBlur={(e) => {
                          const secs = Math.min(60, Math.max(2, Number(e.target.value) || 6));
                          void patch.mutateAsync({ slot, duration_ms: secs * 1000 });
                        }}
                      />
                      {ad.media_type === "video" && (
                        <span className="text-xs text-muted-foreground">Plays to the end</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={busySlot === slot}
                    onClick={() => {
                      targetSlot.current = slot;
                      inputRef.current?.click();
                    }}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {busySlot === slot ? "Uploading…" : ad ? "Replace" : "Upload advertisement"}
                  </Button>
                  {!ad && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void upsert.mutateAsync({ slot, ad_kind: "adsense", provider: "google" })
                      }
                    >
                      Use AdSense
                    </Button>
                  )}
                  {ad?.media_path && ad.ad_kind !== "adsense" && (
                    <Button size="sm" variant="ghost" onClick={() => setPreviewSlot(slot)}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
                    </Button>
                  )}
                  {ad && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove advertisement ${slot}`}
                      onClick={() => void remove.mutateAsync(slot)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <Dialog open={!!previewAd} onOpenChange={(open) => !open && setPreviewSlot(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Advertisement slot {previewAd?.slot} · building position {previewAd?.slot}
            </DialogTitle>
          </DialogHeader>
          {previewAd?.media_path && (
            <div className="overflow-hidden rounded-lg bg-black">
              <div className="relative aspect-[21/9] w-full">
                <SignedMedia
                  path={previewAd.media_path}
                  source={previewAd.media_source}
                  mediaType={previewAd.media_type}
                  fit="contain"
                  muted
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {buildingPreview && (
        <div className="fixed inset-0 z-50 bg-background">
          <RotatingAdventureScene configMode="platform-free" showAds interactive={false} />
          <Button
            size="sm"
            className="absolute right-4 top-4 z-[60]"
            onClick={() => setBuildingPreview(false)}
          >
            Close preview
          </Button>
        </div>
      )}
    </div>
  );
};

export default HomepageAdvertisementsPage;
