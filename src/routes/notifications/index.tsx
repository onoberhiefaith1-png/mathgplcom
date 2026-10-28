import { createFileRoute } from "@tanstack/react-router";
import NotificationsPage from "@/pages/notifications/NotificationsPage";

export const Route = createFileRoute("/notifications/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notifications · MathGPL" },
      {
        name: "description",
        content:
          "Announcements, system alerts, student questions and responses for your MathGPL account in one notification centre.",
      },
      { property: "og:title", content: "Notifications · MathGPL" },
      {
        property: "og:description",
        content: "Contextual school, teaching and learning notifications — never a general chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
      Notifications could not be loaded. Please try again.
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
      Notification centre not found.
    </main>
  ),
  component: NotificationsPage,
});
