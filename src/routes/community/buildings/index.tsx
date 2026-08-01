import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";

const DESCRIPTION =
  "Buildings shared with MathGPL Community. Preview, like and copy a building into your own gallery.";

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
      kind="building"
      title="Community Buildings"
      subtitle="Copy a building into your own gallery, then apply it to your homepage."
      workspacePath="/homepage/building"
    />
  ),
});
