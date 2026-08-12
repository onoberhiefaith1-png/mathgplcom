import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentClassPage from "@/pages/student/StudentClassPage";

export const Route = createFileRoute("/family/children/$childId/classes/$classId")({
  head: () => ({
    meta: [
      { title: "My child's class — MathGPL" },
      { name: "description", content: "One class as your child sees it: lesson notes, assignments and adventures — read only." },
      { property: "og:title", content: "My child's class — MathGPL" },
      { property: "og:description", content: "One class as your child sees it: lesson notes, assignments and adventures — read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { childId } = Route.useParams();
    return (
      <ViewingFrame userId={childId} kind="student" viewer="parent">
        <StudentClassPage />
      </ViewingFrame>
    );
  },
});
