import { createFileRoute } from "@tanstack/react-router";
import StudentAllAdventuresPage from "@/pages/student/StudentAllAdventuresPage";

export const Route = createFileRoute("/student/adventures/")({
  head: () => ({
    meta: [
      { title: "Adventure — Mathemagine" },
      { name: "description", content: "Play the Mathemagine Adventures your teachers prepared, across all your classes." },
      { property: "og:title", content: "Adventure — Mathemagine" },
      { property: "og:description", content: "Play the Mathemagine Adventures your teachers prepared, across all your classes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentAllAdventuresPage,
});
