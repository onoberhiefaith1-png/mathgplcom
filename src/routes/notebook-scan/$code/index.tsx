import { createFileRoute } from "@tanstack/react-router";
import NotebookScanMobile from "@/pages/NotebookScanMobile";

export const Route = createFileRoute("/notebook-scan/$code/")({
  component: NotebookScanMobile,
});
