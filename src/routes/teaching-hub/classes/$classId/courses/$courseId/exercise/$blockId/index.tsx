import { createFileRoute } from "@tanstack/react-router";
import TeacherExerciseQuestionsPage from "@/pages/class/TeacherExerciseQuestionsPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/courses/$courseId/exercise/$blockId/")({
  head: () => ({
    meta: [
      { title: "Exercise Questions — MathGPL" },
      { name: "description", content: "Open each exercise question on the Test Smartboard and mark its teaching-video checkpoints." },
      { property: "og:title", content: "Exercise Questions — MathGPL" },
      { property: "og:description", content: "Open each exercise question on the Test Smartboard and mark its teaching-video checkpoints." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherExerciseQuestionsPage,
});
