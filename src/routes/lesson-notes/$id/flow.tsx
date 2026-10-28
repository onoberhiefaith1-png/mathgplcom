import { createFileRoute } from "@tanstack/react-router";
import FlowLibraryPage from "@/pages/FlowLibraryPage";

export const Route = createFileRoute("/lesson-notes/$id/flow")({
  component: FlowLibraryPage,
});
