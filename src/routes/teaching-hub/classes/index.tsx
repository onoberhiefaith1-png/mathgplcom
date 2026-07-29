import { createFileRoute } from "@tanstack/react-router";
import TeachingHubClasses from "@/pages/TeachingHubClasses";

export const Route = createFileRoute("/teaching-hub/classes/")({
  component: TeachingHubClasses,
});
