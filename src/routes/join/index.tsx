import { createFileRoute } from "@tanstack/react-router";
import JoinClassPage from "@/pages/JoinClassPage";

export const Route = createFileRoute("/join/")({
  component: JoinClassPage,
});
