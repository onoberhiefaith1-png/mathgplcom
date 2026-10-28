import { createFileRoute } from "@tanstack/react-router";
import StudentCoursesPage from "@/pages/student/StudentCoursesPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/courses/")({
  head: () => ({
    meta: [
      { title: "My Courses — MathGPL" },
      { name: "description", content: "Follow the learning pathway your teacher prepared for your class." },
      { property: "og:title", content: "My Courses — MathGPL" },
      { property: "og:description", content: "Follow the learning pathway your teacher prepared for your class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <StudentFeatureGate item="course_video_link" Page={StudentCoursesPage} />,
});
