import { createFileRoute } from "@tanstack/react-router";
import CommunityHome from "@/pages/community/CommunityHome";
import { ADSENSE_SCRIPT_SRC } from "@/lib/ads/adsense";


const DESCRIPTION =
  "Enter MathGPL Community: the same rotating building, filled with lesson notes, classes, adventures, backgrounds, buildings and assets shared by other educators. Copy anything into your own workspace.";

export const Route = createFileRoute("/community/")({
  head: () => ({
    meta: [
      { title: "MathGPL Community — Discover and copy shared teaching resources" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "MathGPL Community — Discover and copy shared teaching resources" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    // The community rotating building carries the platform advertisement
    // boards, so AdSense must load here as well as on the homepage.
    scripts: [
      { src: ADSENSE_SCRIPT_SRC, async: true, crossOrigin: "anonymous" },
    ],
  }),

  component: CommunityHome,
});
