import { createFileRoute } from "@tanstack/react-router";
import { AppsPage } from "@/components/site/DownloadAcademiaDialog";
import { mathemagineInstallHead } from "@/lib/install/mathemagineApp";

/**
 * Both apps, each with its own Get button that opens that app's own install
 * page. Reachable signed in or out (account menu, front page at every width).
 */
export const Route = createFileRoute("/apps")({
  head: () => ({
    meta: [
      { title: "Download the apps — Mathemagine" },
      { name: "description", content: "Install Mathemagine and the offline Academia app on Android, iPhone / iPad, Windows and Mac." },
      ...mathemagineInstallHead.meta,
    ],
    links: mathemagineInstallHead.links,
  }),
  component: AppsPage,
});
