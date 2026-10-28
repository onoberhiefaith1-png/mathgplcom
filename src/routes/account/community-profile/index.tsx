import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "@/components/auth/RequireAuth";
import CommunityProfileEditorPage from "@/pages/profile/CommunityProfileEditorPage";

const TITLE = "My Community Profile — MathGPL";
const DESCRIPTION =
  "Edit the education profile other people see in MathGPL Community: qualifications, subjects, levels, experience and whether you are listed at all.";

export const Route = createFileRoute("/account/community-profile/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <CommunityProfileEditorPage />
    </RequireAuth>
  ),
});
