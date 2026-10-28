import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentAllSkillBuilderPage from "@/pages/student/StudentAllSkillBuilderPage";

export const Route = createFileRoute("/family/children/$childId/skill-builder/")({
  head: () => ({
    meta: [
      { title: "My child's Courses — MathGPL" },
      { name: "description", content: "course pathways for your child. Read only." },
      { property: "og:title", content: "My child's Courses — MathGPL" },
      { property: "og:description", content: "course pathways for your child. Read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { childId } = Route.useParams();
    return (
      <ViewingFrame userId={childId} kind="student" viewer="parent">
        <StudentAllSkillBuilderPage />
      </ViewingFrame>
    );
  },
});
