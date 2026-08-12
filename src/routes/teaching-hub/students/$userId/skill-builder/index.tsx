import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentAllSkillBuilderPage from "@/pages/student/StudentAllSkillBuilderPage";

export const Route = createFileRoute("/teaching-hub/students/$userId/skill-builder/")({
  head: () => ({
    meta: [
      { title: "Skill Builder — MathGPL" },
      { name: "description", content: "Skill Builder pathways for this student. Read only." },
      { property: "og:title", content: "Skill Builder — MathGPL" },
      { property: "og:description", content: "Skill Builder pathways for this student. Read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId} kind="student" viewer="teacher">
        <StudentAllSkillBuilderPage />
      </ViewingFrame>
    );
  },
});
