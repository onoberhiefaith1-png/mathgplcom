import { createFileRoute } from "@tanstack/react-router";
import SmartCardPage from "@/pages/public/SmartCardPage";

export const Route = createFileRoute("/card/$slug/")({
  component: SmartCardPage,
});
