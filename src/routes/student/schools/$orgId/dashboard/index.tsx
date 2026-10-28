import { createFileRoute } from "@tanstack/react-router";
import WorkspaceHomePage from "@/pages/student/WorkspaceHomePage";

export const Route = createFileRoute("/student/schools/$orgId/dashboard/")({
  head: () => ({
    meta: [
      { title: "School dashboard — MathGPL" },
      { name: "description", content: "The classes, teachers and join options inside your school workspace." },
      { property: "og:title", content: "School dashboard — MathGPL" },
      { property: "og:description", content: "The classes, teachers and join options inside your school workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { orgId } = Route.useParams();
    return <WorkspaceHomePage kind="school" id={orgId} />;
  },
});
