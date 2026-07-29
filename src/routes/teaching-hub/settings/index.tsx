import { createFileRoute } from "@tanstack/react-router";
import TeachingHubSettings from "@/pages/TeachingHubSettings";

export const Route = createFileRoute("/teaching-hub/settings/")({
  component: TeachingHubSettings,
});
