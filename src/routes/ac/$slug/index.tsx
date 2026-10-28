import { createFileRoute } from "@tanstack/react-router";
import GuestAcademiaPage from "@/pages/guest/GuestAcademiaPage";

export const Route = createFileRoute("/ac/$slug/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Guest Academia Session — MathGPL" },
    { name: "description", content: "Watch and complete one shared MathGPL Academia Session." },
    { property: "og:title", content: "Guest Academia Session — MathGPL" },
    { property: "og:description", content: "Watch and complete one shared MathGPL Academia Session." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GuestAcademiaPage,
});