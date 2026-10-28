import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import TeacherDashboard from "@/pages/accounts/TeacherDashboard";

export const Route = createFileRoute("/school/teachers/$userId/")({
  head: () => ({
    meta: [
      { title: "Teacher shared workspace — MathGPL" },
      { name: "description", content: "View a connected teacher's shared school workspace exactly as the teacher sees it." },
      { property: "og:title", content: "Teacher shared workspace — MathGPL" },
      { property: "og:description", content: "View a connected teacher's shared school workspace exactly as the teacher sees it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId}>
        <TeacherDashboard />
      </ViewingFrame>
    );
  },
});
