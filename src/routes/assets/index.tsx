import { createFileRoute } from "@tanstack/react-router";
import Assets from "@/pages/Assets";

export const Route = createFileRoute("/assets/")({
  component: Assets,
});
