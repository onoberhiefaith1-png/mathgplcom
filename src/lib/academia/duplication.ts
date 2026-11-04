import { supabase } from "@/integrations/supabase/client";
import { runDuplicateRequest } from "./duplicateRequests";

export type AcademiaDuplicateKind = "class" | "subject" | "topic" | "subtopic" | "session";
export type AcademiaDuplicateResult = { id: string; kind: AcademiaDuplicateKind; name: string; counts: Record<string, number> };

/** An uncertain retry asks for the first copy, even after closing its menu. */
export async function duplicateAcademiaBranch(kind: AcademiaDuplicateKind, id: string): Promise<AcademiaDuplicateResult> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before duplicating Academia.");
  const rpc = supabase as unknown as { rpc(name: string, args: Record<string, string>): Promise<{ data: unknown; error: { message: string } | null }> };
  return runDuplicateRequest(`${auth.user.id}:${kind}:${id}`, () => crypto.randomUUID(), async requestId => {
    const { data, error } = await rpc.rpc("academia_duplicate_branch", { _kind: kind, _id: id, _request: requestId });
    if (error) throw new Error(error.message);
    const result = data as Partial<AcademiaDuplicateResult> | null;
    if (!result || typeof result.id !== "string" || result.kind !== kind || typeof result.name !== "string") {
      throw new Error("The copy was not confirmed. Try Duplicate again to check the same request.");
    }
    return result as AcademiaDuplicateResult;
  });
}
