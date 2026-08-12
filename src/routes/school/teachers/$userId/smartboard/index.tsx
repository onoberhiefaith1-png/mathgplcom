import { createFileRoute } from "@tanstack/react-router";
import ViewingFrame from "@/components/school/ViewingFrame";
import SmartBoardPage from "@/pages/SmartBoardPage";

export const Route = createFileRoute("/school/teachers/$userId/smartboard/")({
  head: () => ({
    meta: [
      { title: "Shared workspace smartboard — MathGPL" },
      { name: "description", content: "The teacher's smartboard shelf, exactly as they see it — view only." },
      { property: "og:title", content: "Shared workspace smartboard — MathGPL" },
      { property: "og:description", content: "The teacher's smartboard shelf, exactly as they see it — view only." },
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
