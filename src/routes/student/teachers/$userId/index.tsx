import { createFileRoute } from "@tanstack/react-router";
import WorkspaceEntryPage from "@/pages/student/WorkspaceEntryPage";

export const Route = createFileRoute("/student/teachers/$userId/")({
  head: () => ({
    meta: [
      { title: "Enter your teacher's workspace — MathGPL" },
      { name: "description", content: "Choose your teacher's plan, then step inside their building to open their classes and learning." },
      { property: "og:title", content: "Enter your teacher's workspace — MathGPL" },
      { property: "og:description", content: "Choose your teacher's plan, then step inside their building to open their classes and learning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return <WorkspaceEntryPage kind="teacher" id={userId} />;
  },
});
