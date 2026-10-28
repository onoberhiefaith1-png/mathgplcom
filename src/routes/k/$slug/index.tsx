import { createFileRoute } from "@tanstack/react-router";
import GuestCoursePage from "@/pages/guest/GuestCoursePage";

export const Route = createFileRoute("/k/$slug/")({
  head: () => ({
    meta: [
      { title: "Guest Course — MathGPL" },
      { name: "description", content: "Open a shared MathGPL course as a guest: watch, practise and get marked instantly." },
      { property: "og:title", content: "Guest Course — MathGPL" },
      { property: "og:description", content: "Open a shared MathGPL course as a guest: watch, practise and get marked instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestCoursePage,
});
