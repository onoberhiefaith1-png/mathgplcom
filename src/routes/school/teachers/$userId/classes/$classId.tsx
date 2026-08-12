import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import ClassDashboardPage from "@/pages/ClassDashboardPage";

export const Route = createFileRoute("/school/teachers/$userId/classes/$classId")({
  head: () => ({
    meta: [
      { title: "Class review — shared workspace — MathGPL" },
      { name: "description", content: "One class with its students, assignments and progress — view only." },
      { property: "og:title", content: "Class review — shared workspace — MathGPL" },
      { property: "og:description", content: "One class with its students, assignments and progress — view only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId}>
        <ClassDashboardPage />
      </ViewingFrame>
    );
  },
});
