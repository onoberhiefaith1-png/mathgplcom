import { createFileRoute } from "@tanstack/react-router";
import Support from "@/pages/legal/Support";

export const Route = createFileRoute("/support/")({
  head: () => ({
    meta: [
      { title: "Customer Support — MathGPL" },
      {
        name: "description",
        content:
          "Contact MathGPL support for accounts, classes and technical help, and see how payment, invoice and refund support is handled through Paddle.",
      },
      { property: "og:title", content: "Customer Support — MathGPL" },
      {
        property: "og:description",
        content:
          "Contact MathGPL support for accounts, classes and technical help, and see how payment, invoice and refund support is handled through Paddle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Support,
});
