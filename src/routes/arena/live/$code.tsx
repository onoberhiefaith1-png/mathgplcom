import { createFileRoute } from "@tanstack/react-router";
import ArenaLivePage from "@/pages/arena/ArenaLivePage";

export const Route = createFileRoute("/arena/live/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Champions Arena — MathGPL" },
      { name: "description", content: "Live question rankings and overall champions, fitted to one screen." },
      { property: "og:title", content: "Champions Arena — MathGPL" },
      { property: "og:description", content: "Question champions and Top 5 times, updated live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ArenaLivePage,
});
