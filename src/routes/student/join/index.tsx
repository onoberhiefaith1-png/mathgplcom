import { createFileRoute } from "@tanstack/react-router";
import StudentJoinClassPage from "@/pages/student/StudentJoinClassPage";

export const Route = createFileRoute("/student/join/")({
  head: () => ({
    meta: [
      { title: "Join a class — MathGPL" },
      { name: "description", content: "Use the join code from your teacher to add a class to your MathGPL dashboard." },
      { property: "og:title", content: "Join a class — MathGPL" },
      { property: "og:description", content: "Use the join code from your teacher to add a class to your MathGPL dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentJoinClassPage,
});
