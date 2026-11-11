import { createFileRoute } from "@tanstack/react-router";
import NotificationThreadPage from "@/pages/notifications/NotificationThreadPage";

export const Route = createFileRoute("/notifications/$notificationId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notification · Mathemagine" },
      {
        name: "description",
        content: "Read a Mathemagine notification with its full context and respond to the person who sent it.",
      },
      { property: "og:title", content: "Notification · Mathemagine" },
      { property: "og:description", content: "Notification, context and response thread." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
      This notification could not be opened.
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
      Notification not found.
    </main>
  ),
  component: NotificationThreadPage,
});
