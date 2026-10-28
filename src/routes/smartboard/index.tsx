import { createFileRoute } from "@tanstack/react-router";
import SmartBoardPage from "@/pages/SmartBoardPage";

export const Route = createFileRoute("/smartboard/")({
  component: SmartBoardPage,
});
