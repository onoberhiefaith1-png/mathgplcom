import { createFileRoute } from "@tanstack/react-router";
import CommunityDirectoryPage from "@/pages/community/CommunityDirectoryPage";

const TITLE = "Students in MathGPL Community";
const DESCRIPTION =
  "Students listed in MathGPL Community appear with only what they chose to share: learning interests, levels and subjects — never a location or personal details.";

export const Route = createFileRoute("/community/students/")({
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
  component: () => <CommunityDirectoryPage role="student" />,
});
