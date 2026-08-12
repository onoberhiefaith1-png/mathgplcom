import { createFileRoute } from "@tanstack/react-router";
import SharedWorkspaceHub from "@/pages/school/shared/SharedWorkspaceHub";

export const Route = createFileRoute("/school/teachers/$userId/")({
  head: () => ({
    meta: [
      { title: "Teacher shared workspace — MathGPL" },
      {
        name: "description",
        content: "View a connected teacher's shared school workspace: lesson notes, smartboard, classes, adventure and skill builder.",
      },
      { property: "og:title", content: "Teacher shared workspace — MathGPL" },
      { property: "og:description", content: "Review a connected teacher's school workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return <SharedWorkspaceHub userId={userId} />;
  },
});
