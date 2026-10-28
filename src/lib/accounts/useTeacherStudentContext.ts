/**
 * The context a teacher has with one student.
 *
 * A teacher does not see the student's whole learning life: they see the
 * student through the classes they teach them in, inside the workspace the
 * teacher is currently working in. That is exactly what this resolves.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { useConnections } from "@/lib/connections/useConnections";

export function useTeacherStudentContext(userId: string, enabled = true) {
  const { activeOrgId } = useWorkspace();
  const { data: accepted } = useConnections("accepted");
  const student = (accepted ?? []).find((c) => c.counterpartUserId === userId) ?? null;

  const classes = useQuery({
    queryKey: ["teacher-student-context", userId, activeOrgId ?? "personal"],
    enabled: enabled && Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user;
      if (!me) return [] as string[];

      const base = supabase.from("classes").select("id").eq("owner_id", me.id);
      const { data: mine } = await (activeOrgId ? base.eq("org_id", activeOrgId) : base.is("org_id", null));
      const ids = ((mine ?? []) as { id: string }[]).map((r) => r.id);
      if (ids.length === 0) return [];

      const { data: members } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("user_id", userId)
        .in("class_id", ids);
      return ((members ?? []) as { class_id: string }[]).map((m) => m.class_id);
    },
  });

  return {
    orgId: activeOrgId ?? null,
    name: student?.counterpartName ?? null,
    classIds: classes.data ?? [],
    isLoading: classes.isLoading,
  };
}
