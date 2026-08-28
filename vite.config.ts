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
const restartAfterTsconfigChange = () => ({
  name: "mathgpl-restart-after-tsconfig-change",
  apply: "serve" as const,
  configureServer(server: { watcher: { on: (event: string, listener: (path: string) => void) => void } }) {
    let restartScheduled = false;
    server.watcher.on("change", (path) => {
      if (restartScheduled || !/(^|[/\\])tsconfig(?:\.[^/\\]+)?\.json$/.test(path)) return;
      restartScheduled = true;
      console.warn("[stability] TypeScript configuration changed; restarting the dev server cleanly.");
      setTimeout(() => process.exit(1), 150);
    });
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
    plugins: [restartAfterTsconfigChange(), mcpPlugin()],
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
