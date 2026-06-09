// Teacher-only SmartBoard control: hand live editing rights to ONE approved
// student at a time. Teacher always retains control. Selecting a new student
// instantly revokes the previous one's editing rights.

import { useCallback, useEffect, useState } from "react";
import { Users, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";

type Member = { user_id: string; display_name: string | null };

const ActiveStudentControl = ({
  classId,
  activeStudentId,
  onSelect,
  chromeBg,
  chromeFg,
  chromeBorder,
  accent,
}: {
  classId: string;
  activeStudentId: string | null;
  onSelect: (uid: string | null) => void;
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
  accent: string;
}) => {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  const load = useCallback(async () => {
    const { data: memRows } = await supabase
      .from("class_members")
      .select("user_id")
      .eq("class_id", classId)
      .order("joined_at", { ascending: true });
    const ids = (memRows ?? []).map((m) => m.user_id);
    let names: Record<string, string | null> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabase.rpc("get_class_member_names", { _class_id: classId });
      names = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.display_name]));
    }
    setMembers(ids.map((id) => ({ user_id: id, display_name: names[id] ?? null })));
  }, [classId]);

  useEffect(() => {
    if (!open) return;
    load();
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`active-student-members-${classId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_members", filter: `class_id=eq.${classId}` },
          () => load(),
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [open, classId, load]);

  const activeName = members.find((m) => m.user_id === activeStudentId)?.display_name;

  return (
    <div data-sb-chrome className="fixed z-40" style={{ left: 12, top: "calc(50% - 92px)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Student Can Edit"
        title="Student Can Edit — grant one student editing rights"
        className="grid place-items-center rounded-full border transition-all"
        style={{
          width: 44,
          height: 44,
          background: chromeBg,
          color: activeStudentId ? accent : chromeFg,
          borderColor: activeStudentId ? accent : chromeBorder,
          boxShadow: activeStudentId
            ? `0 0 14px ${accent}, 0 2px 10px rgba(0,0,0,0.18)`
            : "0 2px 10px rgba(0,0,0,0.18)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Users className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-12 w-60 rounded-xl border p-2 text-sm"
          style={{ background: chromeBg, color: chromeFg, borderColor: chromeBorder, backdropFilter: "blur(12px)" }}
        >
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-70">
            Student Can Edit
          </div>
          <div className="px-2 pb-2 text-[11px] opacity-60">
            {activeStudentId
              ? `${activeName ?? "A student"} can edit`
              : "Select one student to grant editing"}
          </div>
          <button
            onClick={() => onSelect(null)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-black/10"
          >
            <span>Teacher only — take back control</span>
            {!activeStudentId && <Check className="h-4 w-4" style={{ color: accent }} />}
          </button>
          <div className="my-1 border-t" style={{ borderColor: chromeBorder }} />
          {members.length === 0 ? (
            <div className="px-2 py-3 text-center text-[12px] opacity-60">No approved students yet.</div>
          ) : (
            <ul className="max-h-64 overflow-auto">
              {members.map((m) => {
                const isActive = m.user_id === activeStudentId;
                return (
                  <li key={m.user_id}>
                    <button
                      onClick={() => onSelect(isActive ? null : m.user_id)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-black/10"
                    >
                      <span className="truncate">{m.display_name ?? m.user_id.slice(0, 8)}</span>
                      {isActive && <Check className="h-4 w-4" style={{ color: accent }} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ActiveStudentControl;
