import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentAllAdventuresPage from "@/pages/student/StudentAllAdventuresPage";

export const Route = createFileRoute("/family/children/$childId/adventures/")({
  head: () => ({
    meta: [
      { title: "My child's adventures — MathGPL" },
      { name: "description", content: "Adventures prepared for your child. Read only." },
      { property: "og:title", content: "My child's adventures — MathGPL" },
      { property: "og:description", content: "Adventures prepared for your child. Read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { childId } = Route.useParams();
    return (
      <ViewingFrame userId={childId} kind="student" viewer="parent">
        <StudentAllAdventuresPage />
      </ViewingFrame>
    );
  },
});
