import { createFileRoute } from "@tanstack/react-router";
import AcademyCoursePage from "@/pages/academy/AcademyCoursePage";

export const Route = createFileRoute("/academy/course/$courseId/")({
  head: () => ({
    meta: [
      { title: "Academy course — MathGPL" },
      { name: "description", content: "Work through a course you found on an Academy shelf." },
      { property: "og:title", content: "Academy course — MathGPL" },
      { property: "og:description", content: "Work through a course you found on an Academy shelf." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcademyCoursePage,
});
