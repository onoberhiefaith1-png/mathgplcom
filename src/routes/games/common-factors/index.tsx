import { createFileRoute } from "@tanstack/react-router";
import CommonFactorsHub from "@/pages/CommonFactorsHub";

export const Route = createFileRoute("/games/common-factors/")({
  component: CommonFactorsHub,
});
