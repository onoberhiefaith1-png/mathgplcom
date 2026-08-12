import { createFileRoute } from "@tanstack/react-router";
import SchoolMemberWorkspacePage from "@/pages/school/SchoolMemberWorkspacePage";

export const Route = createFileRoute("/school/students/$userId/")({
  head: () => ({
    meta: [
      { title: "Student school workspace — MathGPL" },
      { name: "description", content: "Observe one student's school workspace: classes, assignments and progress." },
      { property: "og:title", content: "Student school workspace — MathGPL" },
      { property: "og:description", content: "Observe one student's school workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return <SchoolMemberWorkspacePage userId={userId} kind="student" />;
  },
});
