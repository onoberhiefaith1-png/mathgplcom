import { createFileRoute } from "@tanstack/react-router";
import SessionMcqPage from "@/pages/academia/mcq/SessionMcqPage";

export const Route = createFileRoute("/academia/mcq/$activityId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Multiple Choice — MathGPL Academia" },
      { name: "description", content: "Answer the Session's multiple-choice questions and see your score." },
      { property: "og:title", content: "Multiple Choice — MathGPL Academia" },
      { property: "og:description", content: "Answer the Session's multiple-choice questions and see your score." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SessionMcqPage,
});
