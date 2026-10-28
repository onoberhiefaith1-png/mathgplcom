import { createFileRoute } from "@tanstack/react-router";
import ClassSmartBoardLauncher from "@/pages/class/ClassSmartBoardLauncher";

export const Route = createFileRoute("/teaching-hub/classes/$classId/smartboard/")({
  component: ClassSmartBoardLauncher,
});
