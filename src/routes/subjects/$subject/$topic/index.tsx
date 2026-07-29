import { createFileRoute } from "@tanstack/react-router";
import TopicSubtopics from "@/pages/TopicSubtopics";

export const Route = createFileRoute("/subjects/$subject/$topic/")({
  component: TopicSubtopics,
});
