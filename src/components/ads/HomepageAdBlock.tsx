import { useState } from "react";
import AdSenseUnit from "@/components/ads/AdSenseUnit";
import { HOMEPAGE_AD_SLOT_ID } from "@/lib/ads/adsense";

/**
 * The single in-page homepage advertisement, sitting in a natural break between
 * two cinematic sections. It matches the surrounding dark surface and hides
 * itself entirely when Google does not fill it, so the page never shows a blank
 * advertising gap. Nothing renders until an ad-unit ID is configured.
 */
const HomepageAdBlock = () => {
  const [hidden, setHidden] = useState(false);

  if (!HOMEPAGE_AD_SLOT_ID || hidden) return null;

  return (
    <section aria-label="Advertisement" className="bg-[hsl(224_70%_6%)] px-6 py-14">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/35">
          Advertisement
        </p>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <AdSenseUnit
            slotId={HOMEPAGE_AD_SLOT_ID}
            className="min-h-[120px] w-full"
            onFilled={(filled) => setHidden(!filled)}
          />
        </div>
      </div>
    </section>
  );
};

export default HomepageAdBlock;
