import { supabase } from '@/integrations/supabase/client';
import { createGradeQueue } from './completionProgress';
const run = createGradeQueue();
type Options = { body: Record<string, unknown>; signal?: AbortSignal };
/** One writer per assessment/participant namespace. Verdicts still come from the existing marking engine. */
export function invokeGradeLine(options: Options) {
  const body = options.body;
  const invoke = async () => {
    if (options.signal?.aborted) return { data: null, error: new Error('Marking request superseded') };
    const result = await supabase.functions.invoke('grade-line', options);
    if (!result.error && result.data?.correct && body.persist !== false && !body.candidates) {
      window.dispatchEvent(new CustomEvent('arena:grade-saved', { detail: { assessmentId: body.assessmentId } }));
    }
    return result;
  };
  if (body.persist === false || body.candidates) return invoke();
  const key = JSON.stringify([body.assessmentId, body.guestSlug ?? body.smartCardSlug ?? 'signed-in', body.participantKey ?? '']);
  return run(key, invoke);
}
