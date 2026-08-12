import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentDashboard from "@/pages/accounts/StudentDashboard";

export const Route = createFileRoute("/school/students/$userId/")({
  head: () => ({
    meta: [
      { title: "Student workspace — MathGPL" },
      {
        name: "description",
        content: "Open a student's own MathGPL dashboard as their school sees it — read only.",
      },
      { property: "og:title", content: "Student workspace — MathGPL" },
      { property: "og:description", content: "A student's dashboard, viewed by their school — read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId} kind="student" viewer="school">
        <StudentDashboard />
      </ViewingFrame>
    );
  },
});
