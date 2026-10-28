import { createFileRoute } from "@tanstack/react-router";
import CommunityDiscoverPage from "@/pages/community/CommunityDiscoverPage";

const DESCRIPTION =
  "Find schools, teachers and students in the MathGPL Community of Practice and send a connection request. Discovery is opt-in and never exposes private account details.";

export const Route = createFileRoute("/community/discover/")({
  head: () => ({
    meta: [
      { title: "Community of Practice — Find schools, teachers and students" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community of Practice — Find schools, teachers and students" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityDiscoverPage,
});
