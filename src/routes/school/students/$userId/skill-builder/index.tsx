import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentAllSkillBuilderPage from "@/pages/student/StudentAllSkillBuilderPage";

export const Route = createFileRoute("/school/students/$userId/skill-builder/")({
  head: () => ({
    meta: [
      { title: "Courses — MathGPL" },
      { name: "description", content: "course pathways for this student. Read only." },
      { property: "og:title", content: "Courses — MathGPL" },
      { property: "og:description", content: "course pathways for this student. Read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId} kind="student" viewer="school">
        <StudentAllSkillBuilderPage />
      </ViewingFrame>
    );
  },
});
