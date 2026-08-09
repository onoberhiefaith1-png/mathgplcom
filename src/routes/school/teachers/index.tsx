import { createFileRoute } from "@tanstack/react-router";
import SchoolPeoplePage from "@/pages/school/SchoolPeoplePage";

export const Route = createFileRoute("/school/teachers/")({
  head: () => ({
    meta: [
      { title: "Teachers in this school — MathGPL" },
      {
        name: "description",
        content:
          "The teachers connected to your school. Open any teacher's own school workspace in view-only mode.",
      },
      { property: "og:title", content: "Teachers in this school — MathGPL" },
      { property: "og:description", content: "The teachers connected to your school." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <SchoolPeoplePage kind="teachers" />,
});
