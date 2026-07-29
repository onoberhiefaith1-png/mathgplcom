import { createFileRoute } from "@tanstack/react-router";
import TeachingHub from "@/pages/TeachingHub";

export const Route = createFileRoute("/teaching-hub/")({
  component: TeachingHub,
});
