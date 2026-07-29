import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, PlusCircle, Trash2 } from "lucide-react";
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
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/teaching-hub" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Teaching Hub
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Classes</h1>
        <div className="w-32" />
      </header>
      <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT — Create Class */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Create Class</h2>
            <Link
              to="/teaching-hub/classes/create"
              className="group flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 to-primary/5 p-8 text-center backdrop-blur transition hover:scale-[1.02] hover:shadow-2xl"
            >
              <PlusCircle className="h-10 w-10 text-primary" />
              <div className="text-xl font-semibold">Create Class</div>
              <p className="max-w-xs text-sm text-muted-foreground">Start a new classroom. No lesson notes needed.</p>
            </Link>
          </section>

          {/* RIGHT — Join Class */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Join Class</h2>
            <JoinClassPanel />
          </section>
        </div>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          owned.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Classes</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {owned.map((c) => (
                  <div key={c.id} className="group relative rounded-xl border border-border bg-card/40 p-4 backdrop-blur transition hover:border-primary/40">
                    <Link to={`/teaching-hub/classes/${c.id}`} className="block">
                      <div className="truncate text-base font-semibold">{c.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Join code: <code className="rounded bg-background px-1.5 py-0.5">{c.join_code}</code></div>
                    </Link>
                    <button
                      onClick={() => deleteClass(c)}
                      className="absolute right-2 top-2 rounded-md border border-border bg-background/60 p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
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
      </main>
    </div>
  );
};

export default TeachingHubClasses;
