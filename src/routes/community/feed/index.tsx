import { createFileRoute } from "@tanstack/react-router";
import CommunityFeedPage from "@/pages/community/CommunityFeedPage";

const TITLE = "Community Feed — What educators are sharing on MathGPL";
const DESCRIPTION =
  "Updates, teaching ideas, announcements and resource launches posted by teachers, schools, students and parents in the MathGPL Community.";

export const Route = createFileRoute("/community/feed/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityFeedPage,
});
