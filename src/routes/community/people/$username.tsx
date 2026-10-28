import { createFileRoute } from "@tanstack/react-router";
import CommunityPersonPage from "@/pages/community/CommunityPersonPage";

const TITLE = "Community Profile — MathGPL Community";
const DESCRIPTION =
  "A full MathGPL Community education profile: qualifications, subjects, levels, experience and the teaching content this account shares.";

export const Route = createFileRoute("/community/people/$username")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityPersonPage,
});
