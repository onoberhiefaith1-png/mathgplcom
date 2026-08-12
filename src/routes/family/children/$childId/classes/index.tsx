import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentClassesPage from "@/pages/accounts/StudentClassesPage";

export const Route = createFileRoute("/family/children/$childId/classes/")({
  head: () => ({
    meta: [
      { title: "My child's classes — MathGPL" },
      { name: "description", content: "The classes your child belongs to. Read only." },
      { property: "og:title", content: "My child's classes — MathGPL" },
      { property: "og:description", content: "The classes your child belongs to. Read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { childId } = Route.useParams();
    return (
      <ViewingFrame userId={childId} kind="student" viewer="parent">
        <StudentClassesPage />
      </ViewingFrame>
    );
  },
});
