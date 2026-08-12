import { createFileRoute } from "@tanstack/react-router";
import SharedSkillBuilderPage from "@/pages/school/shared/SharedSkillBuilderPage";

export const Route = createFileRoute("/school/teachers/$userId/skill-builder")({
  head: () => ({
    meta: [
      { title: "Shared workspace skill builder — MathGPL" },
      { name: "description", content: "Review the Skill Builder courses a connected teacher built inside your school." },
      { property: "og:title", content: "Shared workspace skill builder — MathGPL" },
      { property: "og:description", content: "Skill Builder courses inside your school." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return <SharedSkillBuilderPage userId={userId} />;
  },
});
