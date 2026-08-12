import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import SmartBoardPage from "@/pages/SmartBoardPage";

export const Route = createFileRoute("/school/teachers/$userId/smartboard/$notebookId")({
  head: () => ({
    meta: [
      { title: "Watch class board — MathGPL" },
      { name: "description", content: "The teacher's smartboard presentation, view only." },
      { property: "og:title", content: "Watch class board — MathGPL" },
      { property: "og:description", content: "The teacher's smartboard presentation, view only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return (
      <ViewingFrame userId={userId}>
        <SmartBoardPage />
      </ViewingFrame>
    );
  },
});
