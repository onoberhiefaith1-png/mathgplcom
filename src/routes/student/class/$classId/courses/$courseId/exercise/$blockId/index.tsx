import { createFileRoute } from "@tanstack/react-router";
import StudentExerciseQuestionsPage from "@/pages/student/StudentExerciseQuestionsPage";
import StudentFeatureGate from "@/components/gateway/StudentFeatureGate";

export const Route = createFileRoute("/student/class/$classId/courses/$courseId/exercise/$blockId/")({
  head: () => ({
    meta: [
      { title: "Exercise Questions — MathGPL" },
      { name: "description", content: "Open the questions in this exercise and solve them on your board." },
      { property: "og:title", content: "Exercise Questions — MathGPL" },
      { property: "og:description", content: "Open the questions in this exercise and solve them on your board." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <StudentFeatureGate item="course_video_link" Page={StudentExerciseQuestionsPage} />,
});
