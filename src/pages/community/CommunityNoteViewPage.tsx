/**
 * Community lesson-note preview — view, never edit.
 *
 * The card in the community feed shows the creator's designed cover; opening it
 * lands here, where the whole note is readable exactly as authored. Copying is
 * the only way to change anything: the copy is yours, the original never moves.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import NoteReader from "@/components/lessonnotes/NoteReader";
import NotebookCover from "@/components/lessonnotes/NotebookCover";
import { downloadResource } from "@/lib/community/community";
import { useCommunityRights } from "@/lib/community/useCommunity";
import type { CommunityCard } from "@/lib/community/types";

const loadCard = async (id: string) => {
  const { data, error } = await supabase
    .from("community_resource_cards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This listing is no longer available.");
  const card = data as unknown as CommunityCard;
  const notebookId = (card.payload?.notebook_id as string | undefined) ?? card.source_id;
  if (!notebookId) return { card, notebook: null };
  const { data: nb } = await supabase
    .from("notebooks")
    .select(
      "id, title, teacher, class_name, session, subject, subtopic, color_index, cover_config, document_json",
    )
    .eq("id", notebookId)
    .maybeSingle();
  return { card, notebook: (nb as Record<string, unknown> | null) ?? null };
};

const CommunityNoteViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canDownload } = useCommunityRights();
  const [busy, setBusy] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["community", "note-view", id],
    queryFn: () => loadCard(String(id)),
    enabled: !!id,
  });

  const copy = async () => {
    if (!data?.card) return;
    setBusy(true);
    try {
      const res = await downloadResource(data.card);
      if (res.kind === "lesson_note") {
        toast({ title: "Copied to your Lesson Notes", description: "It is yours now — edit it freely." });
        navigate(`/lesson-notes/${res.notebookId}`);
      }
    } catch (e) {
      toast({ title: "Copy failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(160deg,hsl(222_47%_11%),hsl(222_44%_16%))] text-dash-surface">
      <header className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <Link
          to="/community/lesson-notes"
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-dash-surface/70 transition hover:text-dash-surface"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Community Lesson Notes
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
        {isLoading ? (
          <p className="text-sm text-dash-surface/70">Loading note…</p>
        ) : error || !data ? (
          <p className="text-sm text-dash-surface/70">{String((error as Error)?.message ?? "Not available.")}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-3">
              {data.notebook && (
                <NotebookCover
                  notebook={{
                    title: (data.notebook.title as string) ?? data.card.title,
                    teacher: (data.notebook.teacher as string) ?? "",
                    class_name: (data.notebook.class_name as string) ?? "",
                    session: (data.notebook.session as string) ?? "",
                    subject: (data.notebook.subject as string) ?? "",
                    subtopic: (data.notebook.subtopic as string) ?? "",
                    color_index: Number(data.notebook.color_index ?? 0),
                    cover_config: data.notebook.cover_config,
                  }}
                />
              )}
              <div>
                <h1 className="text-lg font-semibold">{data.card.title}</h1>
                <p className="text-xs text-dash-surface/60">@{data.card.username ?? "creator"}</p>
              </div>
              {canDownload && (
                <button
                  type="button"
                  onClick={copy}
                  disabled={busy}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-full bg-dash-gold px-4 text-sm font-semibold text-dash-navy transition hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  Copy to My Workspace
                </button>
              )}
              <p className="text-[11px] text-dash-surface/50">
                Read-only preview. Copying gives you your own editable note.
              </p>
            </aside>

            <article className="rounded-2xl bg-white p-6 text-black shadow-[var(--shadow-dash)]">
              {data.notebook?.document_json ? (
                <NoteReader documentJson={data.notebook.document_json} />
              ) : (
                <p className="text-sm text-black/60">This note has no pages yet.</p>
              )}
            </article>
          </div>
        )}
      </main>
    </div>
  );
};

export default CommunityNoteViewPage;
