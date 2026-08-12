import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentClassesPage from "@/pages/accounts/StudentClassesPage";

export const Route = createFileRoute("/teaching-hub/students/$userId/classes/")({
  head: () => ({
    meta: [
      { title: "My Classes — MathGPL" },
      { name: "description", content: "The classes this student belongs to. Read only." },
      { property: "og:title", content: "My Classes — MathGPL" },
      { property: "og:description", content: "The classes this student belongs to. Read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId} kind="student" viewer="teacher">
        <StudentClassesPage />
      </ViewingFrame>
    );
  },
});
