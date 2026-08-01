import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Image, Landmark } from "lucide-react";
import CommunityHubPage from "@/pages/community/CommunityHubPage";
import type { WorkspaceTile } from "@/components/workspace/WorkspaceCard";

const DESCRIPTION =
  "The community Building Workspace: shared backgrounds, buildings, assets, decorations, rewards and special effects. Copy any of them into your own homepage galleries.";

const tiles: WorkspaceTile[] = [
  {
    to: "/community/backgrounds",
    label: "Backgrounds",
    description: "Shared scenes behind the building — image, animation or video.",
    icon: Image,
    accent: "from-sky-400/30 to-sky-600/10 border-sky-300/40 text-sky-200",
  },
  {
    to: "/community/buildings",
    label: "Buildings",
    description: "Whole buildings shared by other creators.",
    icon: Landmark,
    accent: "from-violet-400/30 to-violet-600/10 border-violet-300/40 text-violet-200",
  },
  {
    to: "/community/assets",
    label: "Assets",
    description: "Assets, decorations, rewards and special effects.",
    icon: Boxes,
    accent: "from-emerald-400/30 to-emerald-600/10 border-emerald-300/40 text-emerald-200",
  },
];

export const Route = createFileRoute("/community/building/")({
  head: () => ({
    meta: [
      { title: "Community Building Workspace — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Building Workspace — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunityHubPage
      title="Community Building Workspace"
      subtitle="Everything that dresses a homepage: backgrounds, buildings and the assets around them."
      tiles={tiles}
      workspacePath="/homepage/background"
    />
  ),
});
