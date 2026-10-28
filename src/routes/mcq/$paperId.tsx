import { createFileRoute } from "@tanstack/react-router";
import McqExamPage from "@/pages/academia/mcq/McqExamPage";

export const Route = createFileRoute("/mcq/$paperId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Examination Paper — Mathemagine" },
      { name: "description", content: "Answer each multiple-choice question, then review your results." },
      { property: "og:title", content: "Examination Paper — Mathemagine" },
      { property: "og:description", content: "Answer each multiple-choice question, then review your results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: McqExamPage,
});
