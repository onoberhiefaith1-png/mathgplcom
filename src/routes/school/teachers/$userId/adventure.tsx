import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import Adventure from "@/pages/Adventure";

export const Route = createFileRoute("/school/teachers/$userId/adventure")({
  head: () => ({
    meta: [
      { title: "Shared workspace adventures — MathGPL" },
      { name: "description", content: "The teacher's Adventure workspace — view only." },
      { property: "og:title", content: "Shared workspace adventures — MathGPL" },
      { property: "og:description", content: "The teacher's Adventure workspace — view only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId}>
        <Adventure />
      </ViewingFrame>
    );
  },
});
