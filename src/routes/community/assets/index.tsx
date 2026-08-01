import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";

const DESCRIPTION =
  "Library assets — diagrams, structures and media — shared with MathGPL Community. Preview, like and copy any asset into your own asset library.";

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
      kind="asset"
      title="Community Assets"
      subtitle="Copy an asset into your own Asset Library and reuse it in any lesson note."
      workspacePath="/assets"
    />
  ),
});
