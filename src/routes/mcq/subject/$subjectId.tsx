import { createFileRoute } from "@tanstack/react-router";
import SubjectQuestionsPage from "@/pages/academia/mcq/SubjectQuestionsPage";

export const Route = createFileRoute("/mcq/subject/$subjectId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Multiple-Choice Questions — Mathemagine" },
      { name: "description", content: "Past examination papers and practice questions for this subject." },
      { property: "og:title", content: "Multiple-Choice Questions — Mathemagine" },
      { property: "og:description", content: "Past examination papers and practice questions for this subject." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubjectQuestionsPage,
});
