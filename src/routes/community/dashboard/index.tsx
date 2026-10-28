import { createFileRoute } from "@tanstack/react-router";
import MyCommunitySpacePage from "@/pages/community/MyCommunitySpacePage";

const TITLE = "My Community Dashboard — MathGPL";
const DESCRIPTION =
  "Your own MathGPL Community space: manage your professional education profile, the lesson notes and classes you have shared, and the posts you have published.";

export const Route = createFileRoute("/community/dashboard/")({
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
  component: MyCommunitySpacePage,
});
