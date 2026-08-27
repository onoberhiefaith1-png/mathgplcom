import { createFileRoute } from "@tanstack/react-router";
import TeacherExerciseCardsPage from "@/pages/class/TeacherExerciseCardsPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/courses/$courseId/exercises/")({
  head: () => ({
    meta: [
      { title: "Exercise Cards — MathGPL" },
      { name: "description", content: "Test the questions inside each Exercise Card and attach interactive teaching videos." },
      { property: "og:title", content: "Exercise Cards — MathGPL" },
      { property: "og:description", content: "Test the questions inside each Exercise Card and attach interactive teaching videos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherExerciseCardsPage,
});
