import { Link } from "@/lib/router-compat";
import { Compass, Home, LayoutDashboard } from "lucide-react";

import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import { useCommunityIdentity } from "@/lib/community/useCommunity";
import { useBuildingContext } from "@/lib/homepage/useBuildingContext";

/**
 * The Community entrance.
 *
 * The rotating building is the visual identity of MathGPL, so Community keeps
 * it — but it is only a doorway. Behind it there are exactly two destinations:
 * your own Community space, and the wider network. Nothing is built or
 * configured here: Community has no building editor.
 */
const DOORS = [
  {
    to: "/community/dashboard",
    label: "My Dashboard",
    note: "Your professional profile, shared material and activity",
    Icon: LayoutDashboard,
  },
  {
    to: "/community/network",
    label: "Community",
    note: "Discover teachers, schools, live lessons and shared resources",
    Icon: Compass,
  },
];

const CommunityHome = () => {
  const { username } = useCommunityIdentity();
  // Community is a public space: it always uses the platform building pipeline
  // rather than a hard-coded building, and always carries the ads.
  const building = useBuildingContext({ community: true });

  return (
    <>
      {/* Every ring segment leads into the network, never straight to content. */}
      <RotatingAdventureScene
        routeFor={() => "/community/network"}
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

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-wrap justify-center gap-3 p-4 sm:gap-4">
        {DOORS.map(({ to, label, note, Icon }) => (
          <Link
            key={to}
            to={to}
            className="pointer-events-auto w-full max-w-xs rounded-2xl border border-sky-300/40 bg-background/75 px-5 py-4 text-left shadow-[0_0_28px_hsl(205_90%_60%/0.25)] backdrop-blur transition hover:border-sky-200/70 hover:bg-sky-500/15 sm:w-auto"
          >
            <span className="flex items-center gap-2 text-base font-semibold text-sky-50">
              <Icon className="h-5 w-5" />
              {label}
            </span>
            <span className="mt-1 block text-xs text-sky-100/70">{note}</span>
          </Link>
        ))}
      </div>
    </>
  );
};

export default CommunityHome;
