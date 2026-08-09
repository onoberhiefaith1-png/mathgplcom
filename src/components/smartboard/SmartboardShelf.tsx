// Smartboard shelf — same layout as Lesson Notes but each click offers a
// "Open / Present" picker instead of jumping straight into the editor.

import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import NotebookCover, { NotebookCoverData } from "@/components/lessonnotes/NotebookCover";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, PlayCircle, Check } from "lucide-react";
import { loadApprovedAt } from "@/lib/smartboard/presentationPlan";
import { activeSchoolOrgId } from "@/lib/accounts/workspaceScope";

interface NotebookRow extends NotebookCoverData {
  id: string;
}

const PAGE_SIZE = 20;

export const SmartboardShelf = () => {
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }
      // The shelf shows the notes of the workspace being worked in.
      const orgId = await activeSchoolOrgId();
      let query = supabase
        .from("notebooks")
        .select("id,title,teacher,class_name,session,subject,color_index");
      query = orgId ? query.eq("org_id", orgId) : query.is("org_id", null);
      const { data, error } = await query.order("updated_at", { ascending: false });

      if (error) {
        toast({ title: "Could not load notebooks", description: error.message, variant: "destructive" });
      } else {
        setNotebooks((data ?? []) as NotebookRow[]);
      }
      setLoading(false);
    })();
  }, [navigate]);

  const pageStart = page * PAGE_SIZE;
  const pageItems = notebooks.slice(pageStart, pageStart + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(notebooks.length / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-gradient-to-b from-[hsl(28_35%_14%)] via-[hsl(28_30%_10%)] to-[hsl(28_38%_7%)] text-foreground">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-background/40 border-b border-amber-200/10">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.4em] text-amber-300/70">MathGPL</p>
            <h1 className="text-xl font-semibold">Smartboard — Pick a Notebook to Present</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your shelf…</p>
        ) : notebooks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">📓</div>
            <h2 className="text-lg font-semibold">No notebooks yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first lesson note to present on the Smartboard.
            </p>
            <Button className="mt-5" onClick={() => navigate("/lesson-notes")}>
              Go to Lesson Notes
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
              {pageItems.map((nb) => {
                const approvedAt = loadApprovedAt(nb.id);
                return (
                  <div key={nb.id} className="relative group">
                    <NotebookCover
                      notebook={nb}
                      onClick={() => navigate(`/smartboard/${nb.id}/preview`)}
                    />
                    {approvedAt && (
                      <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                        <Check className="h-3 w-3" /> Approved
                      </span>
                    )}
                    <div className="absolute inset-x-2 bottom-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 gap-1 h-8 text-xs backdrop-blur-md bg-white/85 hover:bg-white"
                        onClick={(e) => { e.stopPropagation(); navigate(`/smartboard/${nb.id}/preview`); }}
                      >
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={(e) => { e.stopPropagation(); navigate(`/smartboard/${nb.id}`); }}
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Present
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3 text-sm">
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  ← Previous
                </Button>
                <span className="text-muted-foreground">
                  Shelf {page + 1} of {totalPages}
                </span>
                <Button variant="ghost" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
};

export default SmartboardShelf;
