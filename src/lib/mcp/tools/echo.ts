import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { MCP_AUTH_BUILD } from "../supabase-user";

export default defineTool({
  name: "echo",
  title: "Echo",
  description:
    "Echo the input text back to the caller. Use to verify MCP connectivity.",
  inputSchema: { text: z.string().min(1).describe("Text to echo back.") },
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  // Also reports the (non-secret) build marker and whether this call carried a
  // verified identity, so a live check shows which code answered.
  handler: ({ text }, ctx) => ({
    content: [{ type: "text", text }],
    structuredContent: {
      build: MCP_AUTH_BUILD,
      verifiedCaller: ctx.isAuthenticated() && !!ctx.getUserId(),
    },
  }),
});
