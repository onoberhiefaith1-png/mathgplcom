import { createFileRoute } from "@tanstack/react-router";
import AppInstallPage from "@/components/site/AppInstallPage";
import { installPageHead } from "@/lib/install/appInstallPages";

/**
 * Mathemagine's own install page. Its head holds only Mathemagine's manifest, Home Screen icon
 * and title, sent with the page, so iPhone Safari and Chrome install Mathemagine from here.
 */
const MathemagineInstall = () => <AppInstallPage app="mathemagine" />;

export const Route = createFileRoute("/install/mathemagine")({
  head: () => installPageHead("mathemagine"),
  component: MathemagineInstall,
});
