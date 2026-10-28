/**
 * Community adventure preview — view, never edit. Shows the creator's own game
 * cover and details; copying clones the adventure into your own workspace.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Copy, Gamepad2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useSignedUrl } from "@/components/gamebuilder/SignedMedia";
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
  const gameId = (card.payload?.game_id as string | undefined) ?? card.source_id;
  if (!gameId) return { card, game: null };
  const { data: game } = await supabase
    .from("games")
    .select("id, title, cover_url, thumbnail_path")
    .eq("id", gameId)
    .maybeSingle();
  return { card, game: (game as Record<string, unknown> | null) ?? null };
};

const CommunityAdventureViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canDownload } = useCommunityRights();
  const [busy, setBusy] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["community", "adventure-view", id],
    queryFn: () => loadCard(String(id)),
    enabled: !!id,
  });

  const coverPath =
    (data?.game?.cover_url as string | undefined) ??
    (data?.game?.thumbnail_path as string | undefined) ??
    (data?.card.payload?.cover_path as string | undefined) ??
    null;
  const cover = useSignedUrl(coverPath);

  const copy = async () => {
    if (!data?.card) return;
    setBusy(true);
    try {
      await downloadResource(data.card);
      toast({ title: "Copied to your Adventures", description: "It is yours now — edit it freely." });
      navigate("/adventure");
    } catch (e) {
      toast({ title: "Copy failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(160deg,hsl(222_47%_11%),hsl(222_44%_16%))] text-dash-surface">
      <header className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6">
        <Link
          to="/community/adventure"
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-dash-surface/70 transition hover:text-dash-surface"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Community Adventures
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6">
        {isLoading ? (
          <p className="text-sm text-dash-surface/70">Loading adventure…</p>
        ) : error || !data ? (
          <p className="text-sm text-dash-surface/70">{String((error as Error)?.message ?? "Not available.")}</p>
        ) : (
          <article className="overflow-hidden rounded-2xl border border-dash-surface/15 bg-dash-surface/5">
            <div className="relative aspect-[16/9] w-full bg-dash-navy/40">
              {cover ? (
                <img src={cover} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-dash-surface/50">
                  <Gamepad2 className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="space-y-3 p-6">
              <div>
                <h1 className="text-2xl font-semibold">{data.card.title}</h1>
                <p className="text-xs text-dash-surface/60">@{data.card.username ?? "creator"}</p>
              </div>
              {data.card.description && (
                <p className="text-sm text-dash-surface/75">{data.card.description}</p>
              )}
              {data.card.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {data.card.hashtags.map((t) => (
                    <span key={t} className="rounded-full bg-dash-surface/10 px-2 py-0.5 text-[11px]">{t}</span>
                  ))}
                </div>
              )}
              {canDownload && (
                <button
                  type="button"
                  onClick={copy}
                  disabled={busy}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-dash-gold px-4 text-sm font-semibold text-dash-navy transition hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  Copy to My Workspace
                </button>
              )}
              <p className="text-[11px] text-dash-surface/50">
                Read-only preview. Copying gives you your own editable adventure.
              </p>
            </div>
          </article>
        )}
      </main>
    </div>
  );
};

export default CommunityAdventureViewPage;
