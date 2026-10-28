import { createFileRoute } from "@tanstack/react-router";

import WelcomePage from "@/pages/WelcomePage";
import { getSiteContent } from "@/lib/site/siteContent.functions";
import { EMPTY_SITE_CONTENT, type SiteContent } from "@/lib/site/types";

/**
 * The public MathGPL home page at a stable address. `/` swaps to the rotating
 * building once signed in, so this route is the one place the landing page —
 * Mathematics, Reimagined and everything below it — always renders, signed in
 * or not.
 */
const Welcome = () => <WelcomePage content={Route.useLoaderData()} />;

export const Route = createFileRoute("/welcome")({
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
      { title: "MathGPL — Mathematics, Reimagined." },
      {
        name: "description",
        content:
          "The complete mathematics journey: Smartboard teaching, lesson notes, assignments, adventures and live reports for schools, teachers, students and parents.",
      },
      { property: "og:title", content: "MathGPL — Mathematics, Reimagined." },
      {
        property: "og:description",
        content:
          "The complete mathematics journey: Smartboard teaching, lesson notes, assignments, adventures and live reports for schools, teachers, students and parents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});
