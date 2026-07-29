import { createFileRoute } from "@tanstack/react-router";
import AssetSubcategory from "@/pages/AssetSubcategory";

export const Route = createFileRoute("/assets/$category/$subcategory/")({
  component: AssetSubcategory,
});
