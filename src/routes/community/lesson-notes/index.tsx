import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";

const DESCRIPTION =
  "Lesson notes shared with MathGPL Community by schools, teachers and private educators. Preview, like and copy any note into your own lesson notes workspace.";

export const Route = createFileRoute("/community/lesson-notes/")({
  head: () => ({
    meta: [
      { title: "Community Lesson Notes — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Lesson Notes — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CommunitySectionPage
      kind="lesson_note"
      title="Community Lesson Notes"
      subtitle="Every note educators shared. Copy one and it becomes your own editable note — the original never changes."
      workspacePath="/lesson-notes"
    />
  ),
});
