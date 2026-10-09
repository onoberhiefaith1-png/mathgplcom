import { createFileRoute } from "@tanstack/react-router";
import AcademiaApp from "@/pages/academiaApp/AcademiaApp";

export const Route = createFileRoute("/academia-app")({
  head: () => ({
    meta: [
      { title: "MathGPL Academia — Learn offline" },
      { name: "description", content: "Explore public schools, add them, and do Practice and Play activities with no internet." },
      { property: "og:title", content: "MathGPL Academia — Learn offline" },
      { property: "og:description", content: "Public schools, sessions and activities that work without data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#0b1226" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Academia" },
    ],
    links: [
      { rel: "manifest", href: "/academia-app.webmanifest" },
      { rel: "apple-touch-icon", href: "/academia-icon-192.png" },
    ],
  }),
  component: AcademiaApp,
});
