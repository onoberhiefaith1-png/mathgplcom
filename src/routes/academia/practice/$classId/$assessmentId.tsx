import { createFileRoute } from "@tanstack/react-router";
import AssessmentBoardPage from "@/pages/student/AssessmentBoardPage";

export const Route = createFileRoute("/academia/practice/$classId/$assessmentId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Practice — Mathemagine Academia" },
      { name: "description", content: "Solve this Academia question on the Smartboard." },
      { property: "og:title", content: "Practice — Mathemagine Academia" },
      { property: "og:description", content: "Solve this Academia question on the Smartboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssessmentBoardPage,
});
