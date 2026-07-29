import { createFileRoute } from "@tanstack/react-router";
import QuestionProgressContainerEditor from "@/pages/QuestionProgressContainerEditor";

export const Route = createFileRoute("/assets/interactive/question-progress/")({
  component: QuestionProgressContainerEditor,
});
