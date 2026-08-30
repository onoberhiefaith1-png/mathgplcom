import { createFileRoute } from "@tanstack/react-router";
import CommunityDirectoryPage from "@/pages/community/CommunityDirectoryPage";

const TITLE = "Parents in MathGPL Community";
const DESCRIPTION =
  "Parents listed in MathGPL Community, discovering mathematics teachers, schools and educational resources for their children.";

export const Route = createFileRoute("/community/parents/")({
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
  component: () => <CommunityDirectoryPage role="parent" />,
});
