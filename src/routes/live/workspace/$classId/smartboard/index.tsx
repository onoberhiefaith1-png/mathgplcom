import { createFileRoute } from "@tanstack/react-router";
import ClassSmartBoardLauncher from "@/pages/class/ClassSmartBoardLauncher";

export const Route = createFileRoute("/live/workspace/$classId/smartboard/")({
  component: ClassSmartBoardLauncher,
});
