import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentAllAssignmentsPage from "@/pages/student/StudentAllAssignmentsPage";

export const Route = createFileRoute("/school/students/$userId/assignments/")({
  head: () => ({
    meta: [
      { title: "Assignments — MathGPL" },
      { name: "description", content: "Assignments given to this student. Read only." },
      { property: "og:title", content: "Assignments — MathGPL" },
      { property: "og:description", content: "Assignments given to this student. Read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId} kind="student" viewer="school">
        <StudentAllAssignmentsPage />
      </ViewingFrame>
    );
  },
});
