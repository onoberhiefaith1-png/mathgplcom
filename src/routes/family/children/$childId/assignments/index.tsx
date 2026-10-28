import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentAllAssignmentsPage from "@/pages/student/StudentAllAssignmentsPage";

export const Route = createFileRoute("/family/children/$childId/assignments/")({
  head: () => ({
    meta: [
      { title: "My child's assignments — MathGPL" },
      { name: "description", content: "Assignments given to your child. Read only." },
      { property: "og:title", content: "My child's assignments — MathGPL" },
      { property: "og:description", content: "Assignments given to your child. Read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { childId } = Route.useParams();
    return (
      <ViewingFrame userId={childId} kind="student" viewer="parent">
        <StudentAllAssignmentsPage />
      </ViewingFrame>
    );
  },
});
