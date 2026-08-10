import { createFileRoute } from "@tanstack/react-router";
import TeacherStudentWorkspacePage from "@/pages/teacher/TeacherStudentWorkspacePage";

export const Route = createFileRoute("/teaching-hub/students/$userId")({
  head: () => ({
    meta: [
      { title: "Student workspace — MathGPL Teaching Hub" },
      { name: "description", content: "Observe a connected student's workspace read-only from your Teaching Hub." },
      { property: "og:title", content: "Student workspace — MathGPL Teaching Hub" },
      { property: "og:description", content: "Observe a connected student's workspace read-only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return <TeacherStudentWorkspacePage userId={userId} />;
  },
});
