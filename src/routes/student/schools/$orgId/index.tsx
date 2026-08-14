import { createFileRoute } from "@tanstack/react-router";
import WorkspaceEntryPage from "@/pages/student/WorkspaceEntryPage";

export const Route = createFileRoute("/student/schools/$orgId/")({
  head: () => ({
    meta: [
      { title: "Enter your school — MathGPL" },
      { name: "description", content: "Your school's building: step inside to open its classes and learning." },
      { property: "og:title", content: "Enter your school — MathGPL" },
      { property: "og:description", content: "Your school's building: step inside to open its classes and learning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { orgId } = Route.useParams();
    return <WorkspaceEntryPage kind="school" id={orgId} />;
  },
});
