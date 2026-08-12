import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentJoinClassPage from "@/pages/student/StudentJoinClassPage";

export const Route = createFileRoute("/teaching-hub/students/$userId/join/")({
  head: () => ({
    meta: [
      { title: "Join a class — MathGPL" },
      { name: "description", content: "The student's join-class screen. Read only." },
      { property: "og:title", content: "Join a class — MathGPL" },
      { property: "og:description", content: "The student's join-class screen. Read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId} kind="student" viewer="teacher">
        <StudentJoinClassPage />
      </ViewingFrame>
    );
  },
});
