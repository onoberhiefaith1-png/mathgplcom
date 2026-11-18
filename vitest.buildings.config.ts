import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: [
      "src/lib/building/__tests__/collection.test.ts",
      "src/lib/games/__tests__/imageTransparency.test.ts",
    ],
  },
});
