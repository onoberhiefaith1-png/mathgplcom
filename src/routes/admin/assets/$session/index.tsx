import { createFileRoute } from "@tanstack/react-router";
import GplSessionPage from "@/pages/admin/GplSessionPage";

export const Route = createFileRoute("/admin/assets/$session/")({
  head: () => ({
    meta: [
      { title: "Session — GPL Assets" },
      { name: "description", content: "Sub-sessions inside this official MathGPL asset session." },
      { property: "og:title", content: "Session — GPL Assets" },
      { property: "og:description", content: "Sub-sessions inside this official MathGPL asset session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GplSessionPage,
});
