import { createFileRoute } from "@tanstack/react-router";
import BuildingEditGuard from "@/components/homepage/BuildingEditGuard";
import HomepageBackgroundPage from "@/pages/homepage/HomepageBackgroundPage";

const title = "Change your MathGPL homepage background";
const description =
  "Swap the homepage scene for an image, animated image or looping video without moving the MathGPL building.";

export const Route = createFileRoute("/homepage/background/")({
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
  component: HomepageBackgroundPage,
});
