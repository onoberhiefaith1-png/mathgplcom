import { createFileRoute } from "@tanstack/react-router";
import HomepageAdvertisementsPage from "@/pages/homepage/HomepageAdvertisementsPage";

const title = "Platform advertisements — MathGPL";
const description =
  "Manage the eight platform advertisement slots that play on the MathGPL advertising building.";

export const Route = createFileRoute("/admin/advertisements/")({
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
