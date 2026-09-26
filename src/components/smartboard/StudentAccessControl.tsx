// Teacher-only SmartBoard control: show and toggle whether approved students
// can see this class board live. Mirrors classes.smartboard_visibility, which
// is the gate StudentSmartBoardPage uses before rendering the live mirror.

import { useTableChanges } from "@/lib/stability/useTableChanges";
import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Visibility = "teacher_only" | "student_access_enabled";

const StudentAccessControl = ({
  classId,
  chromeBg,
  chromeFg,
  chromeBorder,
  accent,
}: {
  classId: string;
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
  accent: string;
}) => {
  const { toast } = useToast();
  const [visibility, setVisibility] = useState<Visibility>("teacher_only");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("classes")
      .select("smartboard_visibility")
      .eq("id", classId)
      .maybeSingle();
    const v = (data as { smartboard_visibility?: Visibility } | null)?.smartboard_visibility;
    if (v) setVisibility(v);
  }, [classId]);

  useEffect(() => { void load(); }, [load]);

  // Keep the pill honest if visibility is changed elsewhere (launcher page).
  useTableChanges({
    name: `sb-access-${classId}`,
    private: true,
    watch: [{ table: "classes", event: "UPDATE", filter: `id=eq.${classId}` }],
    onChange: (payload: { new?: { smartboard_visibility?: Visibility } | null }) => {
      const v = payload.new?.smartboard_visibility;
      if (v) setVisibility(v);
    },
    // After a reconnect there is no payload, so read the current value.
    onResync: () => {
      void supabase
        .from("classes")
        .select("smartboard_visibility")
        .eq("id", classId)
        .maybeSingle()
        .then(({ data }) => {
          const v = data?.smartboard_visibility as Visibility | undefined;
          if (v) setVisibility(v);
        });
    },
  });

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next: Visibility = visibility === "student_access_enabled" ? "teacher_only" : "student_access_enabled";
    const { error } = await supabase
      .from("classes")
      .update({ smartboard_visibility: next })
      .eq("id", classId);
    setBusy(false);
    if (error) {
      toast({ title: "Could not change student access", description: error.message, variant: "destructive" });
      return;
    }
    setVisibility(next);
    toast({
      title: next === "student_access_enabled" ? "Students can see this board" : "Board is now teacher only",
    });
  };

  const on = visibility === "student_access_enabled";

  return (
    <div data-sb-chrome className="fixed z-40" style={{ left: 12, top: "calc(50% - 36px)" }}>
      <button
        onClick={toggle}
        aria-label={on ? "Students can see this board" : "Teacher only"}
        title={on ? "Students can see this board — click to stop sharing" : "Teacher only — click to share with students"}
        className="grid place-items-center rounded-full border transition-all"
        style={{
          width: 44,
          height: 44,
          background: chromeBg,
          color: on ? accent : chromeFg,
          borderColor: on ? accent : chromeBorder,
          boxShadow: on ? `0 0 14px ${accent}, 0 2px 10px rgba(0,0,0,0.18)` : "0 2px 10px rgba(0,0,0,0.18)",
          backdropFilter: "blur(10px)",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {on ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
      </button>
    </div>
  );
};

export default StudentAccessControl;
