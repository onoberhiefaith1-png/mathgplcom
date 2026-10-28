import { createFileRoute } from "@tanstack/react-router";
import CommunityDirectoryPage from "@/pages/community/CommunityDirectoryPage";

const TITLE = "Find Schools — MathGPL Community";
const DESCRIPTION =
  "Discover schools listed in MathGPL Community by location, school type, subjects and levels, and connect with their mathematics departments.";

export const Route = createFileRoute("/community/schools/")({
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
  component: () => <CommunityDirectoryPage role="school" />,
});
