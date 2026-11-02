import { createFileRoute } from "@tanstack/react-router";
import QuickIssueTrackerPage from "@/pages/quickIssues/QuickIssueTrackerPage";

export const Route = createFileRoute("/issues/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Issue tracker — MathGPL" },
      { name: "description", content: "The school's shared issue list." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: function QuickIssueRoute() {
    const { token } = Route.useParams();
    return <QuickIssueTrackerPage token={token} />;
  },
});
