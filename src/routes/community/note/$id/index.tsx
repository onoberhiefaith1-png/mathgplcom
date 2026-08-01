import { createFileRoute } from "@tanstack/react-router";
import CommunityNoteViewPage from "@/pages/community/CommunityNoteViewPage";

const DESCRIPTION =
  "Read a lesson note shared with MathGPL Community exactly as its creator designed it, then copy it into your own workspace.";

export const Route = createFileRoute("/community/note/$id/")({
  head: () => ({
    meta: [
      { title: "Shared Lesson Note — MathGPL Community" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Shared Lesson Note — MathGPL Community" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityNoteViewPage,
});
