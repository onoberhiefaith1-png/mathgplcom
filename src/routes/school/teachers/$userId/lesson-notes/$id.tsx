import { createFileRoute } from "@tanstack/react-router";
import SharedNoteViewPage from "@/pages/school/shared/SharedNoteViewPage";

export const Route = createFileRoute("/school/teachers/$userId/lesson-notes/$id")({
  head: () => ({
    meta: [
      { title: "Lesson note — shared workspace — MathGPL" },
      { name: "description", content: "Read a teacher's lesson note exactly as it was authored inside your school." },
      { property: "og:title", content: "Lesson note — shared workspace — MathGPL" },
      { property: "og:description", content: "A teacher's lesson note inside your school." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId, noteId } = Route.useParams();
    return <SharedNoteViewPage userId={userId} noteId={noteId} />;
  },
});
