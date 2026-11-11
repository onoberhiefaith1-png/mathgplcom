import { createFileRoute } from "@tanstack/react-router";
import AppInstallPage from "@/components/site/AppInstallPage";
import { installPageHead } from "@/lib/install/appInstallPages";

/**
 * Academia's own install page. Its head holds only Academia's manifest, Home Screen icon
 * and title, sent with the page, so iPhone Safari and Chrome install Academia from here.
 */
const AcademiaInstall = () => <AppInstallPage app="academia" />;

export const Route = createFileRoute("/install/academia")({
  head: () => installPageHead("academia"),
  component: AcademiaInstall,
});
