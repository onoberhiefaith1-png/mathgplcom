import { createFileRoute } from "@tanstack/react-router";
import ArenaJoinPage from "@/pages/arena/ArenaJoinPage";

export const Route = createFileRoute("/arena/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join the Timer Arena — MathGPL Academia" },
      { name: "description", content: "Join your teacher's MathGPL Academia session and race to solve each question correctly." },
      { property: "og:title", content: "Join the Timer Arena — MathGPL Academia" },
      { property: "og:description", content: "Solve each question correctly in the fastest time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ArenaJoinPage,
});
