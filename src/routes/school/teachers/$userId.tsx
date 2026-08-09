import { createFileRoute } from "@tanstack/react-router";
import SchoolMemberWorkspacePage from "@/pages/school/SchoolMemberWorkspacePage";

export const Route = createFileRoute("/school/teachers/$userId")({
  head: () => ({
    meta: [
      { title: "Teacher school workspace — MathGPL" },
      { name: "description", content: "Observe one teacher's school workspace: classes, lesson notes and reports." },
      { property: "og:title", content: "Teacher school workspace — MathGPL" },
      { property: "og:description", content: "Observe one teacher's school workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return <SchoolMemberWorkspacePage userId={userId} kind="teacher" />;
  },
});
