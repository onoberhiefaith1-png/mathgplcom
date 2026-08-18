import { createFileRoute } from "@tanstack/react-router";
import GplSubSessionPage from "@/pages/admin/GplSubSessionPage";

export const Route = createFileRoute("/admin/assets/$session/$subsession/")({
  head: () => ({
    meta: [
      { title: "Sub-session — GPL Assets" },
      { name: "description", content: "Assets inside this official MathGPL sub-session." },
      { property: "og:title", content: "Sub-session — GPL Assets" },
      { property: "og:description", content: "Assets inside this official MathGPL sub-session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GplSubSessionPage,
});
