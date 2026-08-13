import SignedMedia from "@/components/gamebuilder/SignedMedia";
import AdSenseUnit from "@/components/ads/AdSenseUnit";
import type { AdCreative } from "@/lib/homepage/advertisements";

/**
 * The building's digital billboard.
 *
 * It receives a provider-agnostic creative from the MathGPL advertisement
 * system — it never knows whether the advertisement was uploaded manually or
 * supplied by an external advertising provider such as Google AdSense.
 * Creatives play inside this board only: clipped to it, aspect ratio preserved,
 * never spilling over the building or its inner artwork.
 */
const BuildingBillboard = ({
  creative,
  onVideoEnded,
}: {
  creative: AdCreative;
  onVideoEnded: () => void;
}) => {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[26%] z-10 flex justify-center px-4">
      <div className="w-full max-w-[min(56rem,72vw)]">
        <div className="relative overflow-hidden rounded-lg border-2 border-primary/60 bg-black shadow-[0_0_40px_hsl(var(--primary)/0.35)]">
          <div className="relative aspect-[21/9] w-full">
            {creative.kind === "adsense" && creative.adSlotId ? (
              // The board is the ad pocket: the unit fills it exactly and is
              // clipped to it, so Google's creative can never overlap the
              // building. Pointer events are enabled for this board only.
              <div className="pointer-events-auto absolute inset-0 overflow-hidden">
                <AdSenseUnit
                  key={`adsense:${creative.slot}`}
                  slotId={creative.adSlotId}
                  format="horizontal"
                  className="h-full w-full"
                  style={{ display: "block", width: "100%", height: "100%" }}
                />
              </div>
            ) : creative.mediaPath ? (
              <SignedMedia
                key={`${creative.slot}:${creative.mediaPath}`}
                path={creative.mediaPath}
                source={creative.mediaSource}
                mediaType={creative.mediaType}
                fit="contain"
                muted
                loop={false}
                onEnded={onVideoEnded}
                className="absolute inset-0 h-full w-full"
              />
            ) : null}
          </div>
          <span className="absolute left-2 top-2 rounded bg-background/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
            Ad
          </span>
        </div>
      </div>
    </div>
  );
};

export default BuildingBillboard;
