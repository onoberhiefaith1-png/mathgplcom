import { createFileRoute } from "@tanstack/react-router";
import SmartCardPage from "@/pages/public/SmartCardPage";

export const Route = createFileRoute("/c/$slug/")({
  component: SmartCardPage,
});
