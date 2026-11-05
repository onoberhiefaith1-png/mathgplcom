// Client entry for the shared lesson-note session arranger. The rules live in
// supabase/functions/notebook-ai/sessionArrange.ts so the edge function's
// Preserve arranger and the AI Edit panel produce identical sessions.
export {
  arrangeLessonSessions,
  boldSession,
  looksLikeQuestion,
  parseSessionBlocks,
  sessionMarkerAt,
  stripQuestionEcho,
  type ArrangeOptions,
  type SessionMarker,
  type SessionMarkerKind,
} from "../../../supabase/functions/notebook-ai/sessionArrange";
