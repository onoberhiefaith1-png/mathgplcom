import { Link } from "@/lib/router-compat";
import { BookOpen, Boxes, Gamepad2, Home, Image, Landmark, Users } from "lucide-react";

import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import { useCommunityIdentity } from "@/lib/community/useCommunity";

/**
 * MathGPL Community home — the very same rotating building, only the content
 * behind each section comes from what other educators shared. Nothing here
 * creates, generates or edits: the community is for discovering and copying.
 */
const COMMUNITY_BUILDING_ROUTE = "/community/lesson-notes";

const SECTIONS = [
  { to: "/community/lesson-notes", label: "Lesson Notes", Icon: BookOpen },
  { to: "/community/classes", label: "Classes", Icon: Users },
  { to: "/community/adventure", label: "Adventure", Icon: Gamepad2 },
  { to: "/community/backgrounds", label: "Backgrounds", Icon: Image },
  { to: "/community/buildings", label: "Buildings", Icon: Landmark },
  { to: "/community/assets", label: "Assets", Icon: Boxes },
];

const CommunityHome = () => {
  const { username } = useCommunityIdentity();

  return (
    <>
      {/* Every ring segment leads into the community mirror, never a private page. */}
      <RotatingAdventureScene routeFor={() => COMMUNITY_BUILDING_ROUTE} />

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
        {SECTIONS.map(({ to, label, Icon }) => (
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
