import { createFileRoute } from "@tanstack/react-router";
import SharedSmartboardPage from "@/pages/school/shared/SharedSmartboardPage";

export const Route = createFileRoute("/school/teachers/$userId/smartboard/")({
  head: () => ({
    meta: [
      { title: "Shared workspace smartboard — MathGPL" },
      { name: "description", content: "Choose a class to watch the board a connected teacher is teaching on." },
      { property: "og:title", content: "Shared workspace smartboard — MathGPL" },
      { property: "og:description", content: "Watch a teacher's class board live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return <SharedSmartboardPage userId={userId} />;
  },
});
