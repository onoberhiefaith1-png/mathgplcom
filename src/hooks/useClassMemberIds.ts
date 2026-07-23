// Live enrolled class members (progress-bar math source of truth).
// This is intentionally distinct from any presence/"active" concept — it only
// reflects whether a student currently belongs to the class.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useClassMemberIds(classId: string | null | undefined) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (!classId) { setIds([]); return; }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("class_members")
        .select("user_id")
        .eq("class_id", classId);
      if (cancelled) return;
      setIds(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
    };
    void load();
    const ch = supabase
      .channel(`class-members-${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_members", filter: `class_id=eq.${classId}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [classId]);

  return { ids, count: ids.length };
}
