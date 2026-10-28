import { createFileRoute } from "@tanstack/react-router";
import SchoolPeoplePage from "@/pages/school/SchoolPeoplePage";

export const Route = createFileRoute("/school/students/")({
  head: () => ({
    meta: [
      { title: "Students in this school — MathGPL" },
      {
        name: "description",
        content:
          "The students belonging to your school. Open any student's own school workspace in view-only mode.",
      },
      { property: "og:title", content: "Students in this school — MathGPL" },
      { property: "og:description", content: "The students belonging to your school." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <SchoolPeoplePage kind="students" />,
});
