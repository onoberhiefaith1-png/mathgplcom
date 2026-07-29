import { createFileRoute } from "@tanstack/react-router";
import TeachingHubArchive from "@/pages/TeachingHubArchive";

export const Route = createFileRoute("/teaching-hub/settings/archive/")({
  component: TeachingHubArchive,
});
