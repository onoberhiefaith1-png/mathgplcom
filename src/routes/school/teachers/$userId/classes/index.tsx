import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import TeachingHubClasses from "@/pages/TeachingHubClasses";

export const Route = createFileRoute("/school/teachers/$userId/classes/")({
  head: () => ({
    meta: [
      { title: "Shared workspace classes — MathGPL" },
      { name: "description", content: "The teacher's classes, exactly as they see them — view only." },
      { property: "og:title", content: "Shared workspace classes — MathGPL" },
      { property: "og:description", content: "The teacher's classes, exactly as they see them — view only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId}>
        <TeachingHubClasses />
      </ViewingFrame>
    );
  },
});
