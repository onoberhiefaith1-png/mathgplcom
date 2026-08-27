import { createFileRoute } from "@tanstack/react-router";
import TeacherExerciseQuestionsPage from "@/pages/class/TeacherExerciseQuestionsPage";

export const Route = createFileRoute("/course-builder/$courseId/exercise/$blockId/")({
  head: () => ({
    meta: [
      { title: "Test Exercise Questions — MathGPL" },
      {
        name: "description",
        content: "Open each question in this Exercise Card on the Test Smartboard and attach its interactive teaching video.",
      },
      { property: "og:title", content: "Test Exercise Questions — MathGPL" },
      {
        property: "og:description",
        content: "Open each question in this Exercise Card on the Test Smartboard and attach its interactive teaching video.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherExerciseQuestionsPage,
});
