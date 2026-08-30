import { createFileRoute } from "@tanstack/react-router";
import CommunitySearchPage from "@/pages/community/CommunitySearchPage";

const TITLE = "Search MathGPL Community — People, content and topics";
const DESCRIPTION =
  "One search across MathGPL Community: teachers, schools, students, parents, lesson notes, courses, classes, adventures and live teaching rooms.";

export const Route = createFileRoute("/community/search/")({
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
  component: CommunitySearchPage,
});
