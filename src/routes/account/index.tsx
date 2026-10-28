import { createFileRoute } from "@tanstack/react-router";
import MyAccountPage from "@/pages/accounts/MyAccountPage";

export const Route = createFileRoute("/account/")({
  head: () => ({
    meta: [
      { title: "My account — MathGPL ID, email and password" },
      {
        name: "description",
        content:
          "View your permanent MathGPL ID and account type, and update the email address and password you sign in with.",
      },
      { property: "og:title", content: "My account — MathGPL ID, email and password" },
      {
        property: "og:description",
        content: "View your MathGPL ID and update the email address and password you sign in with.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyAccountPage,
});
