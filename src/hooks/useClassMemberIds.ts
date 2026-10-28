// Live enrolled class members (progress-bar math source of truth).
// This is intentionally distinct from any presence/"active" concept — it only
// reflects whether a student currently belongs to the class.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTableChanges } from "@/lib/stability/useTableChanges";

export function useClassMemberIds(classId: string | null | undefined) {
  const [ids, setIds] = useState<string[]>([]);
  const latest = useRef(classId);
  latest.current = classId;

  const load = useCallback(async () => {
    if (!classId) return;
    const { data } = await supabase
      .from("class_members")
      .select("user_id")
      .eq("class_id", classId);
    if (latest.current !== classId) return;
    setIds(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  }, [classId]);

  useEffect(() => {
    if (!classId) { setIds([]); return; }
    void load();
  }, [classId, load]);

  useTableChanges({
    name: `class-members-${classId}`,
    enabled: !!classId,
    watch: [{ table: "class_members", filter: `class_id=eq.${classId}` }],
    onChange: () => { void load(); },
  });

  return { ids, count: ids.length };
}
