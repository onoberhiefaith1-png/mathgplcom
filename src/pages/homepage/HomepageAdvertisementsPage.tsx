import { useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Lock, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import { renderPathOf, uploadGameAsset } from "@/lib/games/assets";
import { useAccount } from "@/lib/accounts/useAccount";
import { AD_SLOTS, useAdvertisements } from "@/lib/homepage/advertisements";

/**
 * The platform's 8 advertisement slots.
 *
 * Advertisements exist ONLY here and play ONLY on the Free building's
 * billboard (and in Community). Nothing else in the application shows ads.
 */
const HomepageAdvertisementsPage = () => {
  const { isPlatformOwner, isLoading } = useAccount();
  const { ads, upsert, patch, remove } = useAdvertisements();
  const [busySlot, setBusySlot] = useState<number | null>(null);
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
            Only the platform can place advertisements on the Free building.
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
      });
      toast.success(`Advertisement ${slot} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Homepage
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Building Advertisements</h1>
        <div className="w-24" />
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 pb-16">
        <p className="text-sm text-muted-foreground">
          Each slot owns one of the eight outer positions of the advertising building. As a
          position turns toward the viewer its advertisement appears on the central billboard; an
          image keeps the building turning, while a video holds the building still until it has
          played to the end. Empty or disabled slots keep the building's own artwork.
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
            return (
              <div key={slot} className="rounded-2xl border border-border bg-card/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Advertisement slot {slot}</p>
                    <p className="text-xs text-muted-foreground">Outer building position {slot}</p>
                  </div>
                  {ad && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={ad.is_active}
                        onCheckedChange={(v) => void patch.mutateAsync({ slot, is_active: v })}
                      />
                    </div>
                  )}
                </div>

                <div className="h-36 w-full overflow-hidden rounded-lg bg-black">
                  {ad?.media_path ? (
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
                  <div className="mt-3 flex items-center gap-2">
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
                )}

                <div className="mt-3 flex gap-2">
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
                  {ad && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Clear advertisement ${slot}`}
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
    </div>
  );
};

export default HomepageAdvertisementsPage;
