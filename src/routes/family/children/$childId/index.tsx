import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentDashboard from "@/pages/accounts/StudentDashboard";

export const Route = createFileRoute("/family/children/$childId/")({
  head: () => ({
    meta: [
      { title: "My child's workspace — MathGPL" },
      { name: "description", content: "Your child's own MathGPL dashboard and progress, viewed by a parent — read only." },
      { property: "og:title", content: "My child's workspace — MathGPL" },
      { property: "og:description", content: "Your child's own MathGPL dashboard and progress, viewed by a parent — read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { childId } = Route.useParams();
    return (
      <ViewingFrame userId={childId} kind="student" viewer="parent">
        <StudentDashboard />
      </ViewingFrame>
    );
  },
});
