import { createFileRoute } from "@tanstack/react-router";
import RequireRole from "@/components/auth/RequireRole";
import HomepageBuildingPage from "@/pages/homepage/HomepageBuildingPage";

const title = "Edit the Free MathGPL building artwork";
const description =
  "Replace the artwork inside the platform-owned Free building that carries the advertisement billboard.";

export const Route = createFileRoute("/homepage/building/free")({
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
      <HomepageBuildingPage />
    </RequireRole>
  ),
});
