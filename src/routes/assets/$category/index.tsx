import { createFileRoute } from "@tanstack/react-router";
import AssetCategory from "@/pages/AssetCategory";

export const Route = createFileRoute("/assets/$category/")({
  component: AssetCategory,
});
