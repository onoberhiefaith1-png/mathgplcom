import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";
import { BUILDING_SECTIONS } from "@/lib/community/mode";

const DESCRIPTION =
  "Buildings shared with MathGPL Community. Preview a building and copy it into your own building gallery to use on your homepage.";

export const Route = createFileRoute("/community/buildings/")({
  head: () => ({
    meta: [
      { title: "Community Buildings — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Buildings — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunitySectionPage
      tabs={[{ kind: "building", label: "Buildings" }]}
      title="Community Buildings"
      subtitle="Copy a building into your gallery, then apply it from your own homepage settings."
      workspacePath="/homepage/replace-building"
      backTo="/community/building"
      backLabel="Community Building Workspace"
      siblings={BUILDING_SECTIONS}
    />
  ),
});
