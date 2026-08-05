import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { PlusCircle, Users } from "lucide-react";
import ClassPageShell from "@/components/class/ClassPageShell";
import ShareMenu from "@/components/community/ShareMenu";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import JoinClassPanel from "@/components/class/JoinClassPanel";
import SectionCard from "@/components/ui/SectionCard";
import { SECTION_CARD_CLASS, sectionCardStyle } from "@/lib/theme/sectionThemes";


type OwnedClass = { id: string; name: string; join_code: string };

const TeachingHubClasses = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [owned, setOwned] = useState<OwnedClass[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate("/auth?redirect=/teaching-hub/classes");
      return;
    }
    const uid = userData.user.id;

    const { data: ownedRows } = await supabase
      .from("classes")
      .select("id, name")
      .eq("owner_id", uid)
      .eq("workspace", "classroom")
      .order("created_at", { ascending: false });
    const { data: codeRows } = await supabase.rpc("get_owned_class_codes");
    const codeMap = new Map<string, string>(
      (codeRows ?? []).map((r: { id: string; join_code: string }) => [r.id, r.join_code]),
    );
    setOwned(
      ((ownedRows ?? []) as { id: string; name: string }[]).map((c) => ({
        ...c,
        join_code: codeMap.get(c.id) ?? "",
      })),
    );
    setLoading(false);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const deleteClass = async (c: OwnedClass) => {
    if (!window.confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("classes").delete().eq("id", c.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Class deleted" });
    load();
  };

  return (
    <ClassPageShell
      backTo="/teaching-hub"
      backLabel="Teaching Hub"
      title="Classes"
      subtitle="Create a class, join one, or open a class you already own."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          theme="classes"
          to="/teaching-hub/classes/create"
          icon={PlusCircle}
          label="Create Class"
          description="Start a new classroom. No lesson notes needed."
          className="h-fit p-6"
        />

        <div className="rounded-2xl border border-section-ink/15 p-6 text-section-ink" style={sectionCardStyle("smartboard")}>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-section-ink-muted">Join Class</div>
          <JoinClassPanel light />
        </div>
      </div>

      {loading ? (
        <div className="mt-8 text-center text-sm text-dash-surface/70">Loading…</div>
      ) : (
        owned.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface/70">Your Classes</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {owned.map((c) => (
                <div
                  key={c.id}
                  className={`${SECTION_CARD_CLASS} p-5`}
                  style={sectionCardStyle("students")}
                >
                  <Link to={`/teaching-hub/classes/${c.id}`} className="block">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-section-ink/15 text-section-ink shadow-inner backdrop-blur transition-transform duration-300 group-hover:scale-110">
                      <Users className="h-5 w-5" />
                    </span>
                    <div className="mt-4 truncate text-lg font-semibold text-section-ink drop-shadow-sm">{c.name}</div>
                    <div className="mt-1 text-xs text-section-ink-muted">
                      Join code: <code className="rounded bg-section-ink/15 px-1.5 py-0.5 text-section-ink">{c.join_code}</code>
                    </div>
                  </Link>
                  <ShareMenu
                    className="absolute right-3 top-3 opacity-0 transition group-hover:opacity-100"
                    kind="class"
                    sourceId={c.id}
                    title={c.name}
                    description="Members request access — the class is never copied."
                    hashtags="#Class"
                    payload={{ class_id: c.id }}
                    onShareChange={async (shared) => {
                      await supabase.from("classes").update({ community_shared: shared }).eq("id", c.id);
                    }}
                    onDelete={() => deleteClass(c)}
                    deleteLabel="Delete class"
                  />

                </div>
              ))}
            </div>
          </section>
        )
      )}
    </ClassPageShell>
  );
};


export default TeachingHubClasses;
