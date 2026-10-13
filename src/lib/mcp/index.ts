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
import previewStructuredLessonTool from "./tools/preview-structured-lesson";
import previewLessonRepairTool from "./tools/preview-lesson-repair";
import {
  setSolutionHighlightsTool,
  generateSolutionFloatingNumbersTool,
  validateLessonFloatingNumbersTool,
} from "./tools/floating-prep";
import { operateFloatingNumbersTool } from "./tools/operate-floating";

// The OAuth issuer must be the direct Supabase host. Build from the project
// ref (Vite inlines this at build time) so the emitted function has a
// well-formed literal and stays import-safe.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mathgpl",
  title: "MATHGPL",
  version: "0.3.0",
  instructions:
    "You operate MATHGPL as the signed-in teacher. Author lesson notes yourself: do not delegate to Copilot, AI Edit or paid generators. ALWAYS load get_operating_guide first and get_lesson_standards for the subject. Reuse stated counts/context, invite optional material once, then create the full lesson draft. Call preview_structured_lesson, correct problems, show the draft and checking limits, and wait for explicit acceptance. Save only the exact accepted payload with save_structured_lesson, confirmed: true and approvalDigest. Unsupported mathematics needs explicit teacher review. Saving does not publish or assign work. Ask before deleting, assigning or publishing. All account tools remain owner-scoped.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    echoTool,
    getOperatingGuideTool,
    getLessonStandardsTool,
    previewStructuredLessonTool,
    saveStructuredLessonTool,
    previewLessonRepairTool,
    setSolutionHighlightsTool,
    generateSolutionFloatingNumbersTool,
    validateLessonFloatingNumbersTool,
    operateFloatingNumbersTool,
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
