import { createFileRoute } from "@tanstack/react-router";
import RequireRole from "@/components/auth/RequireRole";
import HomepageReplaceBuildingPage from "@/pages/homepage/HomepageReplaceBuildingPage";

const title = "Replace the Free building";
const description =
  "Upload a whole new Free building, preview it, then apply it for free accounts and Community.";

export const Route = createFileRoute("/homepage/replace-building/free")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole roles={["platform_owner", "co_admin"]}>
      <HomepageReplaceBuildingPage />
    </RequireRole>
  ),
});
