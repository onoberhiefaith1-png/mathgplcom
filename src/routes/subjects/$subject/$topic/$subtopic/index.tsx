import { createFileRoute } from "@tanstack/react-router";
import SubtopicGame from "@/pages/SubtopicGame";

export const Route = createFileRoute("/subjects/$subject/$topic/$subtopic/")({
  component: SubtopicGame,
});
