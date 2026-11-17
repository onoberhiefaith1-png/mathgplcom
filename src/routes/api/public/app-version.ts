import { createFileRoute } from "@tanstack/react-router";

/** Same id the client bakes in via VITE_APP_BUILD_ID (set in vite.config.ts). */
const BUILD = (import.meta.env.VITE_APP_BUILD_ID as string | undefined) || "dev";

/** Live build id with a no-store header so installed apps can never cache a stale manifest. */
export const Route = createFileRoute("/api/public/app-version")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { build: BUILD },
          {
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate",
              Pragma: "no-cache",
            },
          },
        ),
    },
  },
});
