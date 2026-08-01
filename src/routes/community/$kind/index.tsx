import { createFileRoute } from "@tanstack/react-router";
import CommunityBrowsePage from "@/pages/community/CommunityBrowsePage";
import { COMMUNITY_KINDS, KIND_PLURAL, type CommunityKind } from "@/lib/community/types";

const isKind = (v: string): v is CommunityKind =>
  COMMUNITY_KINDS.some((k) => k.kind === v);

const describe = (kind: string) =>
  `Browse ${isKind(kind) ? KIND_PLURAL[kind].toLowerCase() : "resources"} shared by MathGPL educators in MyGPL Community and copy them into your own workspace.`;

export const Route = createFileRoute("/community/$kind/")({
  head: ({ params }) => {
    const label = isKind(params.kind) ? KIND_PLURAL[params.kind] : "Resources";
    const title = `${label} — MyGPL Community`;
    return {
      meta: [
        { title },
        { name: "description", content: describe(params.kind) },
        { property: "og:title", content: title },
        { property: "og:description", content: describe(params.kind) },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: CommunitySection,
});

function CommunitySection() {
  const { kind } = Route.useParams();
  if (!isKind(kind)) {
    return (
      <CommunityBrowsePage
        title="MyGPL Community"
        subtitle="That section does not exist — here is everything instead."
      />
    );
  }
  return (
    <CommunityBrowsePage
      kind={kind}
      title={`Community ${KIND_PLURAL[kind]}`}
      subtitle={
        kind === "class"
          ? "Public classes you can request access to. The teacher approves or rejects every request."
          : "Downloading copies the resource straight into your own workspace."
      }
    />
  );
}
