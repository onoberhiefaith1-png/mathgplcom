import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import NotebookEditorPage from "@/pages/NotebookEditorPage";

export const Route = createFileRoute("/school/teachers/$userId/lesson-notes/$id")({
  head: () => ({
    meta: [
      { title: "Lesson note — shared workspace — MathGPL" },
      { name: "description", content: "A teacher's lesson note in the real editor, frozen for viewing." },
      { property: "og:title", content: "Lesson note — shared workspace — MathGPL" },
      { property: "og:description", content: "A teacher's lesson note in the real editor, frozen for viewing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId}>
        <NotebookEditorPage />
      </ViewingFrame>
    );
  },
});
