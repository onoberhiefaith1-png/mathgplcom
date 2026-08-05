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
    theme: "community",
  },
  {
    to: "/community/buildings",
    label: "Buildings",
    description: "Whole buildings shared by other creators.",
    icon: Landmark,
    theme: "gallery",
  },
  {
    to: "/community/assets",
    label: "Assets",
    description: "Assets, decorations, rewards and special effects.",
    icon: Boxes,
    theme: "skillBuilder",
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
