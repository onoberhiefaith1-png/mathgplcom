import { createFileRoute } from "@tanstack/react-router";
import SharedClassDetailPage from "@/pages/school/shared/SharedClassDetailPage";

export const Route = createFileRoute("/school/teachers/$userId/classes/$classId")({
  head: () => ({
    meta: [
      { title: "Class review — shared workspace — MathGPL" },
      { name: "description", content: "Review one class: its students, assignments, adventures and progress." },
      { property: "og:title", content: "Class review — shared workspace — MathGPL" },
      { property: "og:description", content: "Students, assignments and progress inside one class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId, classId } = Route.useParams();
    return <SharedClassDetailPage userId={userId} classId={classId} />;
  },
});
