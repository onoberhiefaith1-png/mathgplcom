import { createFileRoute } from "@tanstack/react-router";
import CreateClassPage from "@/pages/CreateClassPage";

export const Route = createFileRoute("/teaching-hub/classes/create/")({
  component: CreateClassPage,
});
