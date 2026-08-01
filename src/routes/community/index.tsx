import { createFileRoute } from "@tanstack/react-router";
import CommunityBrowsePage from "@/pages/community/CommunityBrowsePage";

const DESCRIPTION =
  "Discover lesson notes, classes, adventures, backgrounds, buildings and assets published by MathGPL educators, and copy them into your own workspace.";

export const Route = createFileRoute("/community/")({
  head: () => ({
    meta: [
      { title: "MyGPL Community — Share and discover teaching resources" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "MyGPL Community — Share and discover teaching resources" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunityBrowsePage
      title="MyGPL Community"
      subtitle="Everything educators have chosen to share. Download a resource and it becomes your own independent copy."
    />
  ),
});
