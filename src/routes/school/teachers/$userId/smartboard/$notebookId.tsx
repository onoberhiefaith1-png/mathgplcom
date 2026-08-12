import { createFileRoute } from "@tanstack/react-router";
import SharedSmartboardMirrorPage from "@/pages/school/shared/SharedSmartboardMirrorPage";

export const Route = createFileRoute("/school/teachers/$userId/smartboard/$notebookId")({
  head: () => ({
    meta: [
      { title: "Watch class board — MathGPL" },
      { name: "description", content: "Live view-only mirror of a teacher's class smartboard inside your school." },
      { property: "og:title", content: "Watch class board — MathGPL" },
      { property: "og:description", content: "Live mirror of a class smartboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId, classId } = Route.useParams();
    return <SharedSmartboardMirrorPage userId={userId} classId={classId} />;
  },
});
