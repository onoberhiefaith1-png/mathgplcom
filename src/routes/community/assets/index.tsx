import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";
import { BUILDING_SECTIONS } from "@/lib/community/mode";

const DESCRIPTION =
  "Building assets, decorations, rewards and special effects shared with MathGPL Community. Preview, like and copy any of them into your own workspace.";

export const Route = createFileRoute("/community/assets/")({
  head: () => ({
    meta: [
      { title: "Community Assets — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Assets — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunitySectionPage
      tabs={[
        {
          kind: "asset",
          label: "Assets",
          subtitle: "Copy an asset into your own library and reuse it anywhere.",
        },
        {
          kind: "decoration",
          label: "Decorations",
          subtitle: "Decorations and floating objects placed around the building.",
        },
        { kind: "reward", label: "Rewards", subtitle: "Reward artwork earned inside adventures." },
        {
          kind: "effect",
          label: "Special effects",
          subtitle: "Looping effects — fire, forcefields, light and weather.",
        },
      ]}
      title="Community Assets"
      subtitle="Everything that decorates a building or an adventure."
      workspacePath="/assets"
      backTo="/community/building"
      backLabel="Community Building Workspace"
      siblings={BUILDING_SECTIONS}
    />
  ),
});
