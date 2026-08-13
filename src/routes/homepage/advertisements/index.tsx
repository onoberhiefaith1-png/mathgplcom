import { createFileRoute } from "@tanstack/react-router";
import HomepageAdvertisementsPage from "@/pages/homepage/HomepageAdvertisementsPage";

const title = "Building advertisements";
const description =
  "Manage the eight advertisement slots that play on the MathGPL Free building's billboard.";

export const Route = createFileRoute("/homepage/advertisements/")({
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
  component: HomepageAdvertisementsPage,
});
