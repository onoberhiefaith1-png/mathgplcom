import { createFileRoute } from "@tanstack/react-router";

import RequireRole from "@/components/auth/RequireRole";
import ReferralDashboard from "@/pages/referrals/ReferralDashboard";

export const Route = createFileRoute("/referral/")({
  head: () => ({
    meta: [
      { title: "Refer & Earn — MathGPL" },
      {
        name: "description",
        content:
          "Track your MathGPL referrals from link to registration, subscription and reward, with configurable reward rules.",
      },
      { property: "og:title", content: "Refer & Earn — MathGPL" },
      {
        property: "og:description",
        content:
          "Track your MathGPL referrals from link to registration, subscription and reward, with configurable reward rules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole roles={["platform_owner", "co_admin", "school", "teacher"]}>
      <ReferralDashboard />
    </RequireRole>
  ),
});
