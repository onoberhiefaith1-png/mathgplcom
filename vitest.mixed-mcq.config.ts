import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: { environment: "node", include: [
    "src/lib/lessonnotes/__tests__/inlineMcq.test.ts",
    "src/lib/lessonnotes/__tests__/mixedMcq.test.ts",
    "src/components/academia/mcq/InlineMcqPractice.test.tsx",
    "src/components/academia/mcq/McqText.test.tsx",
    "src/lib/offline/__tests__/inlineMcqBoard.test.ts",
    "src/lib/offline/__tests__/academiaPackNoteRows.test.ts",
    "src/lib/lessonnotes/questionPairs.test.ts",
    "src/lib/academia/mcq/__tests__/*.test.ts",
    "src/lib/academia/mcq/__tests__/*.test.tsx",
    "src/lib/lessonnotes/__tests__/sessionStructure.test.ts",
    "src/lib/lessonnotes/__tests__/upscaleVerifier.test.ts",
    "src/lib/lessonnotes/__tests__/preserveContent.test.ts",
    "src/lib/lessonnotes/__tests__/sessionArrange.test.ts",
  ] },
});
