import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: { environment: "node", include: [
    "src/lib/lessonnotes/__tests__/inlineMcq.test.ts",
    "src/lib/lessonnotes/__tests__/mixedMcq.test.ts",
    "src/components/academia/mcq/InlineMcqPractice.test.tsx",
    "src/lib/offline/__tests__/inlineMcqBoard.test.ts",
    "src/lib/offline/__tests__/academiaPackNoteRows.test.ts",
    "src/lib/lessonnotes/questionPairs.test.ts",
  ] },
});
