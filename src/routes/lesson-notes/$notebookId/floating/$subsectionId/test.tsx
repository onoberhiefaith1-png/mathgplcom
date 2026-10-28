import { createFileRoute } from "@tanstack/react-router";
import FloatingTestBoardPage from "@/pages/floating/FloatingTestBoardPage";

export const Route = createFileRoute("/lesson-notes/$notebookId/floating/$subsectionId/test")({
  ssr: false,
  component: FloatingTestBoardPage,
  head: () => ({
    meta: [
      { title: "Floating Number test board | MathGPL" },
      {
        name: "description",
        content:
          "Temporary question-scoped Smartboard sitting for testing floating numbers, marking and evaluation.",
      },
      { property: "og:title", content: "Floating Number test board | MathGPL" },
      {
        property: "og:description",
        content: "Test one question on the student Smartboard without saving any results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
