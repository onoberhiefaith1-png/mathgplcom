import { createFileRoute } from "@tanstack/react-router";
import ReferralAdminPage from "@/pages/admin/ReferralAdminPage";

const description = "Create, price and target every Mathemagine referral offer from one administrator console.";

export const Route = createFileRoute("/admin/referrals/")({
  head: () => ({
    meta: [
      { title: "Referral console — Mathemagine" },
      { name: "description", content: description },
      { property: "og:title", content: "Referral console — Mathemagine" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReferralAdminPage,
});
