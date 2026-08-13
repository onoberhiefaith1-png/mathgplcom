import { Link } from "@/lib/router-compat";
import { GraduationCap, Home, Radio, Settings2 } from "lucide-react";

import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import { useCommunityIdentity } from "@/lib/community/useCommunity";
import { useBuildingContext } from "@/lib/homepage/useBuildingContext";

/**
 * MathGPL Community home — the very same rotating building, used purely as a
 * navigation hub. No lesson notes, classes, assets or galleries are shown
 * here: each button opens its own dedicated community workspace.
 */
const COMMUNITY_HUB_ROUTE = "/community/teaching-hub";

const ENTRIES = [
  { to: "/community/teaching-hub", label: "Teaching Hub", Icon: GraduationCap },
  { to: "/community/live", label: "MathGPL Live", Icon: Radio },
  { to: "/community/building", label: "Settings", Icon: Settings2 },
];

const CommunityHome = () => {
  const { username } = useCommunityIdentity();
  // Community is a public space: it always uses the platform building pipeline
  // rather than a hard-coded building, and always carries the ads.
  const building = useBuildingContext({ community: true });

  return (
    <>
      {/* Every ring segment leads into the community Teaching Hub, never straight to content. */}
      <RotatingAdventureScene
        routeFor={() => COMMUNITY_HUB_ROUTE}
        configMode={building.configMode}
        showAds={building.adsEnabled}
      />

      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="pointer-events-auto rounded-full border border-sky-300/40 bg-background/70 px-4 py-2 text-sm font-semibold text-sky-100 shadow-[0_0_24px_hsl(205_90%_60%/0.3)] backdrop-blur">
          MathGPL Community
          {username && <span className="ml-2 text-xs font-normal text-sky-200/70">@{username}</span>}
        </div>
        <Link
          to="/"
          className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-primary/40 bg-background/70 px-4 py-2 text-sm font-medium text-primary shadow-lg backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
        >
          <Home className="h-4 w-4" />
          My workspace
        </Link>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-wrap justify-center gap-2 p-4">
        {ENTRIES.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-sky-300/40 bg-background/70 px-4 py-2 text-sm font-medium text-sky-100 shadow-[0_0_20px_hsl(205_90%_60%/0.25)] backdrop-blur transition hover:bg-sky-500/20"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>
    </>
  );
};

export default CommunityHome;
