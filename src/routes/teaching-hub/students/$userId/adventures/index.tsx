import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentAllAdventuresPage from "@/pages/student/StudentAllAdventuresPage";

export const Route = createFileRoute("/teaching-hub/students/$userId/adventures/")({
  head: () => ({
    meta: [
      { title: "Adventure — MathGPL" },
      { name: "description", content: "Adventures prepared for this student. Read only." },
      { property: "og:title", content: "Adventure — MathGPL" },
      { property: "og:description", content: "Adventures prepared for this student. Read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId} kind="student" viewer="teacher">
        <StudentAllAdventuresPage />
      </ViewingFrame>
    );
  },
});
