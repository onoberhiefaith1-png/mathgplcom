import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { PlusCircle, Trash2, Users } from "lucide-react";
import ClassPageShell from "@/components/class/ClassPageShell";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import JoinClassPanel from "@/components/class/JoinClassPanel";

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
        <Link
          to="/teaching-hub/classes/create"
          className="group relative flex flex-col overflow-hidden rounded-2xl border border-dash-border bg-dash-surface p-6 shadow-[var(--shadow-dash)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_26px_54px_-24px_hsl(224_60%_6%/0.7)]"
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-blue-600" />
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-dash-surface shadow-md transition-transform duration-200 group-hover:scale-110">
            <PlusCircle className="h-5 w-5" />
          </span>
          <div className="mt-4 text-lg font-semibold text-dash-surface-foreground">Create Class</div>
          <p className="mt-1 text-xs text-dash-surface-muted">Start a new classroom. No lesson notes needed.</p>
        </Link>

        <div className="rounded-2xl border border-dash-border bg-dash-surface p-6 text-dash-surface-foreground shadow-[var(--shadow-dash)]">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface-muted">Join Class</div>
          <JoinClassPanel />
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
                  className="group relative overflow-hidden rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-[var(--shadow-dash)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_26px_54px_-24px_hsl(224_60%_6%/0.7)]"
                >
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
                  <Link to={`/teaching-hub/classes/${c.id}`} className="block">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-dash-surface shadow-md transition-transform duration-200 group-hover:scale-110">
                      <Users className="h-5 w-5" />
                    </span>
                    <div className="mt-4 truncate text-lg font-semibold text-dash-surface-foreground">{c.name}</div>
                    <div className="mt-1 text-xs text-dash-surface-muted">
                      Join code: <code className="rounded bg-dash-navy/5 px-1.5 py-0.5 text-dash-surface-foreground">{c.join_code}</code>
                    </div>
                  </Link>
                  <button
                    onClick={() => deleteClass(c)}
                    className="absolute right-3 top-3 rounded-lg border border-dash-border bg-dash-surface p-1.5 text-dash-surface-muted opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                    aria-label="Delete class"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
