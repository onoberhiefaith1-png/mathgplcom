// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Preserved from the pre-migration vite.config.ts: the project's MCP plugin.
    plugins: [mcpPlugin()],
    // TanStack Start loads Router and Store from lazy route chunks. If Vite
    // discovers either after startup, the optimizer changes its browser hash
    // while older route chunks are still in flight and responds with 504s.
    // Pre-bundle both during startup so the dependency graph stays stable.
    optimizeDeps: {
      include: ["@tanstack/react-router", "@tanstack/react-store"],
    },
  },
});
