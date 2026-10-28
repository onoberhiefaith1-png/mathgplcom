import { createFileRoute, useParams } from "@tanstack/react-router";
import CommunityFeedPage from "@/pages/community/CommunityFeedPage";

export const Route = createFileRoute("/community/tag/$tag")({
  head: ({ params }) => {
    const title = `#${params.tag} — MathGPL Community`;
    const description = `Every MathGPL Community post tagged #${params.tag}: teaching ideas, resources and updates on this topic.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: HashtagFeed,
});

function HashtagFeed() {
  const { tag } = useParams({ from: "/community/tag/$tag" });
  return <CommunityFeedPage hashtag={tag} />;
}
