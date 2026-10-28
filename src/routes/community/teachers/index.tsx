import { createFileRoute } from "@tanstack/react-router";
import CommunityDirectoryPage from "@/pages/community/CommunityDirectoryPage";

const TITLE = "Find Mathematics Teachers — MathGPL Community";
const DESCRIPTION =
  "Search listed mathematics teachers by subject, level, curriculum, qualification, experience and location, then send a connection request.";

export const Route = createFileRoute("/community/teachers/")({
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
  component: () => <CommunityDirectoryPage role="teacher" />,
});
