import { createFileRoute } from "@tanstack/react-router";
import { mathemagineInstallHead } from "@/lib/install/mathemagineApp";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { currentAppWindow } from "@/lib/install/appInstallPages";
import Index from "@/pages/Index";
import WelcomePage from "@/pages/WelcomePage";
import { useAuth } from "@/lib/auth/AuthProvider";

import { getSiteContent } from "@/lib/site/siteContent.functions";
import { EMPTY_SITE_CONTENT, type SiteContent } from "@/lib/site/types";

/**
 * The front door. Signed-out visitors see the cinematic public homepage; the
 * rotating building — and everything behind it — appears once signed in.
 *
 * The installed Mathemagine app always opens on the rotating building: signed
 * out it shows the building with Log in at the top right, signed in the full
 * building with the account's dashboard and tools.
 */
const Landing = () => {
  const { user, ready } = useAuth();
  const content = Route.useLoaderData();
  // Read after mount so the server render and the first client render agree.
  const [inMathemagineApp, setInMathemagineApp] = useState(false);
  useEffect(() => setInMathemagineApp(currentAppWindow() === "mathemagine"), []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,hsl(220_60%_22%),hsl(224_65%_10%)_60%)] text-white/70">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return user || inMathemagineApp ? <Index /> : <WelcomePage content={content} />;
};

export const Route = createFileRoute("/")({
  // A homepage must never go blank because one fetch failed: fall back to
  // empty content and let the page render its built-in opening screen.
  loader: async (): Promise<SiteContent> => {
    try {
      return await getSiteContent();
    } catch (error) {
      console.error(error);
      return EMPTY_SITE_CONTENT;
    }
  },
  head: () => ({
    meta: [
      { title: "Mathemagine — Mathematics, Reimagined." },
      {
        name: "description",
        content:
          "One platform for the complete mathematics journey: Smartboard teaching, lesson notes, assignments, adventures and live reports for schools, teachers, students and parents.",
      },
      { property: "og:title", content: "Mathemagine — Mathematics, Reimagined." },
      {
        property: "og:description",
        content:
          "One platform for the complete mathematics journey: Smartboard teaching, lesson notes, assignments, adventures and live reports for schools, teachers, students and parents.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...mathemagineInstallHead.meta,
    ],
    // The Mathemagine app is installed from the main website, never from /academia-app.
    links: mathemagineInstallHead.links,
  }),
  component: Landing,
});
