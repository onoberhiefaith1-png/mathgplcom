import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import listNotebooksTool from "./tools/list-notebooks";
import getNotebookTool from "./tools/get-notebook";
import workspaceSnapshotTool from "./tools/workspace-snapshot";
import createNotebookTool from "./tools/create-notebook";
import updateNotebookTool from "./tools/update-notebook";
import solveQuestionTool from "./tools/solve-question";
import generateFloatingTool from "./tools/generate-floating";
import {
  openScreenTool,
  smartboardControlTool,
  getCurrentViewTool,
} from "./tools/live-control";
import { agentActionTools } from "./tools/agent-actions";
import { getOperatingGuideTool, getLessonStandardsTool } from "./tools/guide";
import saveStructuredLessonTool from "./tools/save-structured-lesson";
import previewLessonRepairTool from "./tools/preview-lesson-repair";
import {
  setSolutionHighlightsTool,
  generateSolutionFloatingNumbersTool,
  validateLessonFloatingNumbersTool,
} from "./tools/floating-prep";

// The OAuth issuer must be the direct Supabase host. Build from the project
// ref (Vite inlines this at build time) so the emitted function has a
// well-formed literal and stays import-safe.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mathgpl",
  title: "MATHGPL",
  version: "0.2.0",
  instructions:
    "You operate MATHGPL as the signed-in teacher. ALWAYS call `get_operating_guide` first and follow it; call `get_lesson_standards` before writing lesson content. Save lessons only with `save_structured_lesson` (it validates, saves and reads back). Ask the teacher before deleting, assigning or publishing; such tools need confirmed: true. All tools act only on the teacher's own data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    echoTool,
    getOperatingGuideTool,
    getLessonStandardsTool,
    saveStructuredLessonTool,
    previewLessonRepairTool,
    setSolutionHighlightsTool,
    generateSolutionFloatingNumbersTool,
    validateLessonFloatingNumbersTool,
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
    ...agentActionTools,
  ],
});
