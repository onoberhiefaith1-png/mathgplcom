import { createFileRoute } from "@tanstack/react-router";
import SmartboardPreviewPage from "@/pages/SmartboardPreviewPage";

export const Route = createFileRoute("/smartboard/$notebookId/preview/")({
  component: SmartboardPreviewPage,
});
