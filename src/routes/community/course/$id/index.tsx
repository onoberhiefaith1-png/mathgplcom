import { createFileRoute } from "@tanstack/react-router";
import CommunityCourseViewPage from "@/pages/community/CommunityCourseViewPage";

const TITLE = "Shared Course — MathGPL Community";
const DESCRIPTION =
  "Open a course shared with MathGPL Community exactly as its creator built it: the original sections, the creator's own videos and the original exercises.";

export const Route = createFileRoute("/community/course/$id/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityCourseViewPage,
});
