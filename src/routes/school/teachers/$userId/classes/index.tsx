import { createFileRoute } from "@tanstack/react-router";
import SharedClassesPage from "@/pages/school/shared/SharedClassesPage";

export const Route = createFileRoute("/school/teachers/$userId/classes/")({
  head: () => ({
    meta: [
      { title: "Shared workspace classes — MathGPL" },
      { name: "description", content: "Review the classes a connected teacher created inside your school." },
      { property: "og:title", content: "Shared workspace classes — MathGPL" },
      { property: "og:description", content: "Classes created inside your school." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { userId } = Route.useParams();
    return <SharedClassesPage userId={userId} />;
  },
});
