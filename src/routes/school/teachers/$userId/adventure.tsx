import { createFileRoute } from "@tanstack/react-router";
import SharedAdventurePage from "@/pages/school/shared/SharedAdventurePage";

export const Route = createFileRoute("/school/teachers/$userId/adventure")({
  head: () => ({
    meta: [
      { title: "Shared workspace adventures — MathGPL" },
      { name: "description", content: "Review the adventures a connected teacher built inside your school." },
      { property: "og:title", content: "Shared workspace adventures — MathGPL" },
      { property: "og:description", content: "Adventures built inside your school." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return <SharedAdventurePage userId={userId} />;
  },
});
