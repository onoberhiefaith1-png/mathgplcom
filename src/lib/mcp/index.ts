import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import listNotebooksTool from "./tools/list-notebooks";
import getNotebookTool from "./tools/get-notebook";
import workspaceSnapshotTool from "./tools/workspace-snapshot";
import createNotebookTool from "./tools/create-notebook";
import updateNotebookTool from "./tools/update-notebook";
import solveQuestionTool from "./tools/solve-question";
import generateFloatingTool from "./tools/generate-floating";
import { openScreenTool, smartboardControlTool, getCurrentViewTool } from "./tools/live-control";
import { agentActionTools } from "./tools/agent-actions";

// The OAuth issuer must be the direct Supabase host. Build from the project
// ref (Vite inlines this at build time) so the emitted function has a
// well-formed literal and stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mathgpl",
  title: "MATHGPL",
  version: "0.2.0",
  instructions:
    "Tools for the MATHGPL teaching app. Start with `workspace_snapshot` to see the signed-in teacher's classes and notebooks. Use `create_notebook` / `update_notebook` to build lesson notes (sections: introduction, explanation, example, exercise, classwork, homework, summary; blocks: problem, solution, reasoning, text). Use `solve_question` to save a verified step-by-step solution for an existing question (line 1 must restate the question, one micro-step per line), and `generate_floating` to attach Floating Numbers token lines to a question. Live split-screen: `get_current_view` reads what the teacher has open (use it for explain-this requests), `open_screen` switches their open MathGPL window (note, smartboard, game...), `smartboard_control` moves slides. Before saving or changing anything, confirm with the teacher. `echo` verifies connectivity. All tools act only on the signed-in teacher's own data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    echoTool,
    workspaceSnapshotTool,
    listNotebooksTool,
    getNotebookTool,
    createNotebookTool,
    updateNotebookTool,
    solveQuestionTool,
    generateFloatingTool,
    openScreenTool,
    smartboardControlTool,
    getCurrentViewTool,
  ],
});
