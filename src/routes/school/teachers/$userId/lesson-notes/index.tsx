import { createFileRoute } from "@tanstack/react-router";
import SharedLessonNotesPage from "@/pages/school/shared/SharedLessonNotesPage";

export const Route = createFileRoute("/school/teachers/$userId/lesson-notes/")({
  head: () => ({
    meta: [
      { title: "Shared workspace lesson notes — MathGPL" },
      { name: "description", content: "Read the lesson notes a connected teacher created inside your school." },
      { property: "og:title", content: "Shared workspace lesson notes — MathGPL" },
      { property: "og:description", content: "Lesson notes created inside your school." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return <SharedLessonNotesPage userId={userId} />;
  },
});
