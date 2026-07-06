import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import listNotebooksTool from "./tools/list-notebooks";
import getNotebookTool from "./tools/get-notebook";

// The OAuth issuer must be the direct Supabase host. Build from the project
// ref (Vite inlines this at build time) so the emitted function has a
// well-formed literal and stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "golden-hour-academy-mcp",
  title: "Golden Hour Academy MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Golden Hour Academy teaching app. Use `echo` to verify connectivity, `list_notebooks` to browse the signed-in teacher's lesson notebooks, and `get_notebook` to fetch a specific notebook by id.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [echoTool, listNotebooksTool, getNotebookTool],
});
