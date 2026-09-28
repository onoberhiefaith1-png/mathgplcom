import { createFileRoute } from "@tanstack/react-router";
import AcademiaActivityPage from "@/pages/academia/AcademiaActivityPage";

export const Route = createFileRoute("/academia/activity/$activityId")({
  head: () => ({
    meta: [
      { title: "Practice or Play — MathGPL Academia" },
      { name: "description", content: "Choose Practice or Play for this Academia question." },
      { property: "og:title", content: "Practice or Play — MathGPL Academia" },
      { property: "og:description", content: "A MathGPL Academia activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcademiaActivityPage,
});
