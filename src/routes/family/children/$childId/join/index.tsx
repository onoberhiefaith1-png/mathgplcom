import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import StudentJoinClassPage from "@/pages/student/StudentJoinClassPage";

export const Route = createFileRoute("/family/children/$childId/join/")({
  head: () => ({
    meta: [
      { title: "Join a class — MathGPL" },
      { name: "description", content: "The join-class screen as your child sees it. Read only for a parent." },
      { property: "og:title", content: "Join a class — MathGPL" },
      { property: "og:description", content: "The join-class screen as your child sees it. Read only for a parent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { childId } = Route.useParams();
    return (
      <ViewingFrame userId={childId} kind="student" viewer="parent">
        <StudentJoinClassPage />
      </ViewingFrame>
    );
  },
});
