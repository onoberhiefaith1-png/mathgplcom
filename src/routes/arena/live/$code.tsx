import { createFileRoute } from "@tanstack/react-router";
import ArenaLivePage from "@/pages/arena/ArenaLivePage";

export const Route = createFileRoute("/arena/live/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Live Classroom Leaderboard — MathGPL Timer Arena" },
      { name: "description", content: "Live Champions Wheel and Top 5 times for one MathGPL Academia session group." },
      { property: "og:title", content: "Live Classroom Leaderboard — MathGPL Timer Arena" },
      { property: "og:description", content: "Question champions and Top 5 times, updated live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ArenaLivePage,
});
