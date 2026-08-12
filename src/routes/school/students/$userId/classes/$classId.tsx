import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentClassPage from "@/pages/student/StudentClassPage";

export const Route = createFileRoute("/school/students/$userId/classes/$classId")({
  head: () => ({
    meta: [
      { title: "Student class — MathGPL" },
      {
        name: "description",
        content: "One class as the student sees it: lesson notes, assignments and adventures — view only.",
      },
      { property: "og:title", content: "Student class — MathGPL" },
      { property: "og:description", content: "One class as the student sees it — view only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId} kind="student">
        <StudentClassPage />
      </ViewingFrame>
    );
  },
});
