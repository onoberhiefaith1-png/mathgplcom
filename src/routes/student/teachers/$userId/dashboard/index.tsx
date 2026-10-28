import { createFileRoute } from "@tanstack/react-router";
import WorkspaceHomePage from "@/pages/student/WorkspaceHomePage";

export const Route = createFileRoute("/student/teachers/$userId/dashboard/")({
  head: () => ({
    meta: [
      { title: "Teacher dashboard — MathGPL" },
      { name: "description", content: "The classes and join options inside your teacher's workspace." },
      { property: "og:title", content: "Teacher dashboard — MathGPL" },
      { property: "og:description", content: "The classes and join options inside your teacher's workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return <WorkspaceHomePage kind="teacher" id={userId} />;
  },
});
