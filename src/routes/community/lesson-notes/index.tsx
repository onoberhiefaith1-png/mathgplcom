import { createFileRoute } from "@tanstack/react-router";
import CommunitySectionPage from "@/pages/community/CommunitySectionPage";
import { TEACHING_SECTIONS } from "@/lib/community/mode";

const DESCRIPTION =
  "Lesson notes and lesson-note assets shared with MathGPL Community by schools, teachers and private educators. Preview, like and copy any note or asset into your own workspace.";

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
      tabs={[
        {
          kind: "lesson_note",
          label: "Notes",
          subtitle:
            "Every note educators shared. Copy one and it becomes your own editable note — the original never changes.",
        },
        {
          kind: "lesson_asset",
          label: "Lesson Notes Assets",
          subtitle:
            "Diagrams, graphs, tables and visual teaching resources shared on their own. Copy one into your Asset Library and reuse it in any note.",
        },
      ]}
      title="Community Lesson Notes"
      subtitle="Shared notes and the assets that build them."
      workspacePath="/lesson-notes"
      backTo="/community/network"
      backLabel="Community Teaching Hub"
      siblings={TEACHING_SECTIONS}
    />
  ),
});
