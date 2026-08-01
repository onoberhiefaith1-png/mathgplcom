import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";
import { BUILDING_SECTIONS } from "@/lib/community/mode";

const DESCRIPTION =
  "Backgrounds shared with MathGPL Community — images, animations and looping video for the scene behind your building. Copy any one into your own background gallery.";

export const Route = createFileRoute("/community/backgrounds/")({
  head: () => ({
    meta: [
      { title: "Community Backgrounds — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Backgrounds — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunitySectionPage
      tabs={[{ kind: "background", label: "Backgrounds" }]}
      title="Community Backgrounds"
      subtitle="Copy a background into your own gallery and use it behind your building."
      workspacePath="/backgrounds"
      backTo="/community/building"
      backLabel="Community Building Workspace"
      siblings={BUILDING_SECTIONS}
    />
  ),
});
