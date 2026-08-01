import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";

const DESCRIPTION =
  "Homepage backgrounds shared with MathGPL Community. Preview, like and copy a background into your own gallery.";

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
      kind="background"
      title="Community Backgrounds"
      subtitle="Copy a background into your own gallery and use it behind your building."
      workspacePath="/backgrounds"
    />
  ),
});
