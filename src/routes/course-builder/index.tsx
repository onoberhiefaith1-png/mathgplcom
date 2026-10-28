import { createFileRoute } from "@tanstack/react-router";
import CourseBuilderLibrary from "@/pages/CourseBuilderLibrary";

export const Route = createFileRoute("/course-builder/")({
  head: () => ({
    meta: [
      { title: "Courses — Build Maths Courses | MathGPL" },
      {
        name: "description",
        content: "Build maths courses with videos, exercise cards and certificates, and preview exactly what students see.",
      },
      { property: "og:title", content: "Courses — Build Maths Courses | MathGPL" },
      {
        property: "og:description",
        content: "Build maths courses with videos, exercise cards and certificates, and preview exactly what students see.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourseBuilderLibrary,
});
