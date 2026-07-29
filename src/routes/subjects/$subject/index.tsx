import { createFileRoute } from "@tanstack/react-router";
import SubjectTopics from "@/pages/SubjectTopics";

export const Route = createFileRoute("/subjects/$subject/")({
  component: SubjectTopics,
});
