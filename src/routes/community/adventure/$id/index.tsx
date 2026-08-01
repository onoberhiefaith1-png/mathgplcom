import { createFileRoute } from "@tanstack/react-router";
import CommunityAdventureViewPage from "@/pages/community/CommunityAdventureViewPage";

const DESCRIPTION =
  "Preview an adventure shared with MathGPL Community — cover, details and hashtags — then copy it into your own Adventure workspace.";

export const Route = createFileRoute("/community/adventure/$id/")({
  head: () => ({
    meta: [
      { title: "Shared Adventure — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Shared Adventure — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityAdventureViewPage,
});
