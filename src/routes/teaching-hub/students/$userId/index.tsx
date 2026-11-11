import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentDashboard from "@/pages/accounts/StudentDashboard";

export const Route = createFileRoute("/teaching-hub/students/$userId/")({
  head: () => ({
    meta: [
      { title: "Student workspace — Mathemagine" },
      { name: "description", content: "Open a connected student's own Mathemagine dashboard — read only." },
      { property: "og:title", content: "Student workspace — Mathemagine" },
      { property: "og:description", content: "A student's dashboard, viewed by their teacher — read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId} kind="student" viewer="teacher">
        <StudentDashboard />
      </ViewingFrame>
    );
  },
});
