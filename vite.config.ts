// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// Vite can clear its transform cache after a tsconfig change without
// re-installing TanStack Start's HTML middleware. The process then looks
// healthy while every document request returns an empty 404. Exiting lets the
// platform supervisor perform the only safe recovery: a clean process start.
type WatchServer = {
  watcher: { on: (event: string, listener: (path: string) => void) => void };
  middlewares: {
    use: (
      handler: (
        req: { headers: Record<string, string | string[] | undefined>; url?: string },
        res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (body?: string) => void },
        next: () => void,
      ) => void,
    ) => void;
  };
};

const restartAfterTsconfigChange = () => ({
  name: "mathgpl-restart-after-tsconfig-change",
  apply: "serve" as const,
  // Vite handles tsconfig invalidation before ordinary watcher listeners in
  // some reload paths, so cover both the plugin hot-update hook and watcher.
  handleHotUpdate(context: { file: string }) {
    scheduleRestart(context.file);
  },
  configureServer(server: WatchServer) {
    // Cache-clearing reload paths can surface as add/unlink rather than change.
    for (const event of ["change", "add", "unlink"]) {
      server.watcher.on(event, scheduleRestart);
    }

    // Returning a function registers this middleware AFTER Vite's own stack,
    // so it only runs for requests nothing else handled. A document request
    // reaching here means TanStack Start's HTML middleware is gone — the exact
    // wedged state that answers every page with an empty 404.
    return () => {
      server.middlewares.use((req, res, next) => {
        const accept = String(req.headers["accept"] ?? "");
        if (!accept.includes("text/html")) return next();
        console.warn(
          "[stability] SSR HTML middleware is missing; restarting the dev server cleanly.",
        );
        restartScheduled = true;
        setTimeout(() => process.exit(1), 150);
        res.statusCode = 503;
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.setHeader("retry-after", "2");
        res.end(
          "<!doctype html><meta http-equiv=\"refresh\" content=\"3\"><p>Reloading the dev server…</p>",
        );
      });
    };
  },
});

let restartScheduled = false;
function scheduleRestart(path: string) {
  if (restartScheduled || !/(^|[/\\])tsconfig(?:\.[^/\\]+)?\.json$/.test(path)) return;
  restartScheduled = true;
  console.warn("[stability] TypeScript configuration changed; restarting the dev server cleanly.");
  setTimeout(() => process.exit(1), 150);
}


// The dev source-tagger injects a `data-tsd-source` prop into every JSX
// element. React DOM ignores unknown props, but react-three-fiber treats a
// dashed prop as a nested path (`data.tsd.source`) and throws
// `Cannot set "data-tsd-source"`, blanking any 3D route. Strip the prop from
// modules that render three.js elements; DOM files keep their tags.
const stripSourceTagsFromR3F = () => ({
  name: "mathgpl-strip-tsd-source-in-r3f",
  apply: "serve" as const,
  enforce: "post" as const,
  transform(code: string, id: string) {
    if (!code.includes("data-tsd-source")) return null;
    // Any module that touches three.js may render scene elements.
    if (!/@react-three\/|["']three["']/.test(code) && !/\/geometry3d\/|\/academy\/world\//.test(id)) {
      return null;
    }
    // Keep exactly one separating comma when the prop sat between two others.
    const stripped = code.replace(
      /,?\s*"data-tsd-source":\s*"[^"]*"\s*,?/g,
      (m) => (m.startsWith(",") && m.trimEnd().endsWith(",") ? "," : ""),
    );
    return { code: stripped, map: null };
  },
});

export default defineConfig({

  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Preserved from the pre-migration vite.config.ts: the project's MCP plugin.
    plugins: [restartAfterTsconfigChange(), mcpPlugin(), stripSourceTagsFromR3F()],
    // TanStack Start loads Router internals from lazy route and SSR chunks. If
    // Vite discovers any of these entry points after startup, it replaces its
    // generated chunks while older browser requests are still in flight and
    // responds with 504s. Pre-bundle the complete discovered graph up front.
    optimizeDeps: {
      include: [
        "@tanstack/react-router",
        "@tanstack/react-store",
        "@tanstack/router-core",
        "@tanstack/router-core/isServer",
        "@tanstack/router-core/ssr/client",
        "@tanstack/router-core/ssr/server",
        "@tanstack/history",
        "seroval",
        "h3-v2",
      ],
    },
  },
});
