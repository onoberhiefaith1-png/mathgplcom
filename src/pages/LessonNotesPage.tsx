import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import NotebookCover, { NotebookCoverData } from "@/components/lessonnotes/NotebookCover";
import CreateNotebookDialog, { CreateNotebookValues } from "@/components/lessonnotes/CreateNotebookDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus, LogOut, Presentation, MoreVertical,
  Pencil, Copy, Trash2, Play, Sparkles,
  Archive, Share2, Download, FolderOpen, ArrowLeft,
} from "lucide-react";



interface NotebookRow extends NotebookCoverData {
  id: string;
}

const PAGE_SIZE = 20;

const LessonNotesPage = () => {
  const navigate = useNavigate();
  // Keep the MathGPL Live context when opening a note so Live-only tools
  // (Smart Card publishing) stay available.
  const livePrefix = useLocation().pathname.startsWith("/live") ? "/live" : "";
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);

  // Authentication is handled once by the platform guard (RequireAuth); this
  // page only needs to know who is signed in.
  const { user } = useAuth();
  useEffect(() => {
    setUserEmail(user?.email ?? null);
  }, [user]);


  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notebooks")
      .select("id,title,teacher,class_name,session,subject,color_index")
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Could not load notebooks", description: error.message, variant: "destructive" });
    } else {
      setNotebooks((data ?? []) as NotebookRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async (v: CreateNotebookValues) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const color_index = notebooks.length % 10;
    const { data, error } = await supabase
      .from("notebooks")
      .insert({
        owner_id: user.id,
        teacher: v.teacher,
        class_name: v.class_name,
        session: v.session,
        subject: v.subject,
        title: v.topic.trim() || null,
        subtopic: v.subtopic.trim() || "",
        color_index,
      })
      .select("id")
      .single();
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    navigate(`${livePrefix}/lesson-notes/${data.id}`);
  };

  const renameNotebook = async (nb: NotebookRow) => {
    const next = window.prompt("Rename notebook (topic):", nb.title ?? "");
    if (next === null) return;
    const { error } = await supabase.from("notebooks").update({ title: next.trim() || null }).eq("id", nb.id);
    if (error) toast({ title: "Rename failed", description: error.message, variant: "destructive" });
    else load();
  };

  const deleteNotebook = async (nb: NotebookRow) => {
    if (!window.confirm(`Delete "${nb.title || nb.subject}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("notebooks").delete().eq("id", nb.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  const duplicateNotebook = async (nb: NotebookRow) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("notebooks").insert({
      owner_id: user.id,
      teacher: nb.teacher,
      class_name: nb.class_name,
      session: nb.session,
      subject: nb.subject,
      title: nb.title ? `${nb.title} (copy)` : null,
      color_index: nb.color_index,
    });
    if (error) toast({ title: "Duplicate failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Notebook duplicated" }); load(); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const pageStart = page * PAGE_SIZE;
  const pageItems = notebooks.slice(pageStart, pageStart + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(notebooks.length / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-gradient-to-b from-[hsl(28_35%_14%)] via-[hsl(28_30%_10%)] to-[hsl(28_38%_7%)] text-foreground">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-background/40 border-b border-amber-200/10">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate("/teaching-hub")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-amber-100/80 hover:text-amber-50 hover:bg-amber-200/10"
            aria-label="Back to Teaching Hub"
            title="Back to Teaching Hub"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>


          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.4em] text-amber-300/70">MathGPL</p>
            <h1 className="text-xl font-semibold truncate">Lesson Notes</h1>
          </div>

          {/* Smartboard — visually separated as a tool, not a primary action */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/smartboard")}
            className="gap-2 border-amber-200/20 bg-transparent text-amber-100/90 hover:bg-amber-200/10 hover:text-amber-50"
          >
            <Presentation className="h-4 w-4" /> Smartboard
          </Button>

          <div className="h-6 w-px bg-amber-200/15 mx-1 hidden sm:block" />

          {/* Primary create action — soft glow + hover lift */}
          <Button
            onClick={() => setDialogOpen(true)}
            className="gap-2 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 font-semibold shadow-[0_4px_14px_-2px_hsl(40_90%_55%/0.5)] hover:shadow-[0_8px_22px_-4px_hsl(40_95%_60%/0.7)] hover:-translate-y-0.5 hover:from-amber-200 hover:to-amber-400 transition-all duration-200"
          >
            <Plus className="h-4 w-4" /> Create notebook
          </Button>

          <Button variant="ghost" size="icon" onClick={signOut} title={userEmail ?? "Sign out"}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your shelf…</p>
        ) : notebooks.length === 0 ? (
          <EmptyState onCreate={() => setDialogOpen(true)} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
              {pageItems.map((nb) => (
                <NotebookCard
                  key={nb.id}
                  nb={nb}
                  onOpen={() => navigate(`${livePrefix}/lesson-notes/${nb.id}`)}
                  onPresent={() => navigate(`/smartboard/${nb.id}`)}
                  onRename={() => renameNotebook(nb)}
                  onDuplicate={() => duplicateNotebook(nb)}
                  onDelete={() => deleteNotebook(nb)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3 text-sm">
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  ← Previous
                </Button>
                <span className="text-muted-foreground">Shelf {page + 1} of {totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <CreateNotebookDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={create} />
    </main>
  );
};

const NotebookCard = ({
  nb, onOpen, onPresent, onRename, onDuplicate, onDelete,
}: {
  nb: NotebookRow;
  onOpen: () => void;
  onPresent: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) => {
  const stub = (label: string) => () =>
    toast({ title: `${label} coming soon`, description: "This action is not yet available." });

  return (
    <div className="relative group transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.02] hover:drop-shadow-[0_18px_30px_hsl(40_90%_50%/0.25)]">
      <NotebookCover notebook={nb} onClick={onOpen} />
      <div className="absolute top-1.5 left-4 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-black/40 backdrop-blur-sm text-white/90 hover:bg-black/60"
              aria-label="Notebook actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={onOpen}>
              <FolderOpen className="h-4 w-4 mr-2" /> Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpen}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>
              <Sparkles className="h-4 w-4 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPresent}>
              <Play className="h-4 w-4 mr-2" /> Present on Smartboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={stub("Share")}>
              <Share2 className="h-4 w-4 mr-2" /> Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={stub("Export")}>
              <Download className="h-4 w-4 mr-2" /> Export
            </DropdownMenuItem>
            <DropdownMenuItem onClick={stub("Archive")}>
              <Archive className="h-4 w-4 mr-2" /> Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="text-center py-20">
    <div className="text-5xl mb-3">📓</div>
    <h2 className="text-lg font-semibold">Your shelf is empty</h2>
    <p className="mt-1 text-sm text-muted-foreground">
      Create your first notebook to start preparing lessons.
    </p>
    <Button className="mt-5 gap-2" onClick={onCreate}>
      <Plus className="h-4 w-4" /> Create your first notebook
    </Button>
  </div>
);

export default LessonNotesPage;

