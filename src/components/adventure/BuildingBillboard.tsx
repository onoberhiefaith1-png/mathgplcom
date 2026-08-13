import SignedMedia from "@/components/gamebuilder/SignedMedia";
import type { AdvertisementRow } from "@/lib/homepage/advertisements";

/**
 * The building's digital billboard.
 *
 * Advertisements play inside this board only — clipped to it, aspect ratio
 * preserved, never spilling over the building or its inner artwork. It is
 * rendered only where the advertisement pipeline allows it (the platform Free
 * building and Community), and never anywhere else in the application.
 */
const BuildingBillboard = ({
  ad,
  onVideoEnded,
}: {
  ad: AdvertisementRow;
  onVideoEnded: () => void;
}) => {
  if (!ad.media_path) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[26%] z-10 flex justify-center px-4">
      <div className="w-full max-w-[min(56rem,72vw)]">
        <div className="relative overflow-hidden rounded-lg border-2 border-primary/60 bg-black shadow-[0_0_40px_hsl(var(--primary)/0.35)]">
          <div className="relative aspect-[21/9] w-full">
            <SignedMedia
              key={ad.id}
              path={ad.media_path}
              source={ad.media_source}
              mediaType={ad.media_type}
              fit="contain"
              muted
              loop={false}
              onEnded={onVideoEnded}
              className="absolute inset-0 h-full w-full"
            />
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
