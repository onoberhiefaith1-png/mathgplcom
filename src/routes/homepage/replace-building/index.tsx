import { createFileRoute } from "@tanstack/react-router";
import BuildingEditGuard from "@/components/homepage/BuildingEditGuard";
import HomepageReplaceBuildingPage from "@/pages/homepage/HomepageReplaceBuildingPage";

const title = "Replace the MathGPL homepage building";
const description =
  "Upload a whole new homepage building, position and preview it in the visual editor, then apply it.";

export const Route = createFileRoute("/homepage/replace-building/")({
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
      <HomepageReplaceBuildingPage />
    </BuildingEditGuard>
  ),
});
