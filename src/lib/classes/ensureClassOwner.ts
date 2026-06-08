import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the path to redirect to if the current user is NOT the owner of
 * the given class. Returns null when the user is the owner and the page
 * may render. Used to gate teacher-only routes.
 */
export async function ensureClassOwner(classId: string, userId: string): Promise<string | null> {
  const { data: ownerRow } = await supabase
    .from("classes")
    .select("owner_id")
    .eq("id", classId)
    .maybeSingle();
  if (ownerRow && ownerRow.owner_id === userId) return null;
  return "/teaching-hub/classes";
}
