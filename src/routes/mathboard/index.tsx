import { createFileRoute } from "@tanstack/react-router";
import MathBoardPage from "@/pages/MathBoardPage";

export const Route = createFileRoute("/mathboard/")({
  component: MathBoardPage,
});
