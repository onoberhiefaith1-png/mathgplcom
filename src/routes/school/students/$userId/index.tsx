import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentClassesPage from "@/pages/accounts/StudentClassesPage";

export const Route = createFileRoute("/school/students/$userId/")({
  head: () => ({
    meta: [
      { title: "Student workspace — MathGPL" },
      {
        name: "description",
        content: "View one student's own MathGPL workspace exactly as the student sees it — view only.",
      },
      { property: "og:title", content: "Student workspace — MathGPL" },
      { property: "og:description", content: "View one student's own MathGPL workspace — view only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId} kind="student">
        <StudentClassesPage />
      </ViewingFrame>
    );
  },
});
