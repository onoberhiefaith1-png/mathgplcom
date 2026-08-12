import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import LessonNotesPage from "@/pages/LessonNotesPage";

export const Route = createFileRoute("/school/teachers/$userId/lesson-notes/")({
  head: () => ({
    meta: [
      { title: "Shared workspace lesson notes — MathGPL" },
      { name: "description", content: "The teacher's lesson-note shelf, exactly as they see it — view only." },
      { property: "og:title", content: "Shared workspace lesson notes — MathGPL" },
      { property: "og:description", content: "The teacher's lesson-note shelf, exactly as they see it — view only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId}>
        <LessonNotesPage />
      </ViewingFrame>
    );
  },
});
