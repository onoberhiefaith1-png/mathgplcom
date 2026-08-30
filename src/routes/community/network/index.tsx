import { createFileRoute } from "@tanstack/react-router";
import CommunityNetworkPage from "@/pages/community/CommunityNetworkPage";

const TITLE = "Community — Discover teachers, schools, live lessons and shared resources";
const DESCRIPTION =
  "The MathGPL Community network: see who is teaching live right now, search teachers, schools, students and parents, and explore the lesson notes, classes and adventures they share.";

export const Route = createFileRoute("/community/network/")({
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
  component: CommunityNetworkPage,
});
