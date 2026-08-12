import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import CourseBuilderLibrary from "@/pages/CourseBuilderLibrary";

export const Route = createFileRoute("/school/teachers/$userId/skill-builder")({
  head: () => ({
    meta: [
      { title: "Shared workspace skill builder — MathGPL" },
      { name: "description", content: "The teacher's Skill Builder courses — view only." },
      { property: "og:title", content: "Shared workspace skill builder — MathGPL" },
      { property: "og:description", content: "The teacher's Skill Builder courses — view only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId}>
        <CourseBuilderLibrary />
      </ViewingFrame>
    );
  },
});
