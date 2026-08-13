import { createFileRoute } from "@tanstack/react-router";
import RequireRole from "@/components/auth/RequireRole";
import HomepageBackgroundPage from "@/pages/homepage/HomepageBackgroundPage";

const title = "Change the Free building background";
const description =
  "Swap the scene behind the platform-owned Free building without touching the Pro building.";

export const Route = createFileRoute("/homepage/background/free")({
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
      <HomepageBackgroundPage />
    </RequireRole>
  ),
});
