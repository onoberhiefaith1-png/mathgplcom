import { createFileRoute } from "@tanstack/react-router";
import BuildingEditGuard from "@/components/homepage/BuildingEditGuard";
import HomepageBuildingPage from "@/pages/homepage/HomepageBuildingPage";

const title = "Edit the MathGPL building artwork";
const description =
  "Replace any of the 16 artwork slots inside the original MathGPL building while keeping its exact geometry.";

export const Route = createFileRoute("/homepage/building/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <BuildingEditGuard>
      <HomepageBuildingPage />
    </BuildingEditGuard>
  ),
});
