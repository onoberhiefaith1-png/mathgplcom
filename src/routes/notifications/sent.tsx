import { createFileRoute } from "@tanstack/react-router";
import SentNotificationsPage from "@/pages/notifications/SentNotificationsPage";

export const Route = createFileRoute("/notifications/sent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sent notifications · MathGPL" },
      {
        name: "description",
        content:
          "Review every notification your MathGPL account has sent, with delivery, read and response statistics.",
      },
      { property: "og:title", content: "Sent notifications · MathGPL" },
      { property: "og:description", content: "Delivery, read and response statistics for your notifications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
      Sent notifications could not be loaded.
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
      Page not found.
    </main>
  ),
  component: SentNotificationsPage,
});
