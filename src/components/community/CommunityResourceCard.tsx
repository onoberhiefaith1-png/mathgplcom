import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Copy, Download, Heart, Loader2, MoreVertical, Radio, Trash2, UserPlus, EyeOff, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteResource, downloadResource, requestClassAccess, setResourceStatus } from "@/lib/community/community";
import { KIND_LABEL, type CommunityCard } from "@/lib/community/types";

/**
 * One community card shape for every resource type. Cards always show the
 * creator username, likes, active downloads and hashtags.
 */
const CommunityResourceCard = ({
  card,
  liked,
  onToggleLike,
  canDownload,
  canModerate,
  isOwner,
  onChanged,
}: {
  card: CommunityCard;
  liked: boolean;
  onToggleLike: () => void;
  canDownload: boolean;
  canModerate: boolean;
  isOwner: boolean;
  onChanged: () => void;
}) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const isClass = card.kind === "class";
  const isSession = card.kind === "session";
  const isLessonAsset = card.kind === "lesson_asset";

  const act = async () => {
    setBusy(true);
    try {
      if (isClass) {
        const res = await requestClassAccess(card);
        if ("already" in res) {
          toast({ title: "You are already in this class" });
          navigate(`/student/class/${res.classId}`);
        } else if ("pending" in res) {
          toast({ title: "Request already pending", description: "Waiting for the teacher to approve." });
        } else {
          toast({ title: "Request sent", description: "The teacher will approve or reject it." });
        }
        return;
      }
      if (isSession) {
        const code = (card.payload?.session_code as string | undefined) ?? null;
        if (!code) {
          toast({ title: "This session is not open yet", description: "Ask the teacher for the join link." });
          return;
        }
        navigate(`/live/join/${code}`);
        return;
      }
      const res = await downloadResource(card);
      if (res.kind === "lesson_note") {
        toast({ title: "Copied to your Lesson Notes", description: "It is yours now — edit it freely." });
        navigate(`/lesson-notes/${res.notebookId}`);
      } else if (res.kind === "adventure") {
        toast({ title: "Copied to your Adventures", description: "It is yours now — edit it freely." });
        navigate(`/adventure`);
      } else {
        toast({
          title: isLessonAsset
            ? "Copied to your Asset Library"
            : `${KIND_LABEL[card.kind]} copied to your workspace`,
          description: "Find it in your own gallery.",
        });
      }
      onChanged();
    } catch (e) {
      toast({ title: "Action failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const moderate = async (status: "published" | "unpublished") => {
    try {
      await setResourceStatus(card.id, status);
      onChanged();
    } catch (e) {
      toast({ title: "Could not update", description: String((e as Error)?.message ?? e), variant: "destructive" });
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${card.title}" from MathGPL Community? Existing copies stay with their owners.`)) return;
    try {
      await deleteResource(card.id);
      onChanged();
    } catch (e) {
      toast({ title: "Could not delete", description: String((e as Error)?.message ?? e), variant: "destructive" });
    }
  };

  const preview = (card.payload?.preview_url as string | undefined) ?? null;

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-dash-border bg-dash-surface text-dash-surface-foreground shadow-[var(--shadow-dash)] transition hover:-translate-y-0.5">
      {preview ? (
        <img src={preview} alt="" loading="lazy" className="h-32 w-full object-cover" />
      ) : (
        <div className="h-2 w-full bg-gradient-to-r from-dash-gold/70 to-dash-gold/20" />
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dash-surface-muted">
              {KIND_LABEL[card.kind]}
              {card.status !== "published" && " · unpublished"}
            </p>
            <h3 className="truncate text-base font-semibold">{card.title}</h3>
            <p className="mt-0.5 truncate text-xs text-dash-surface-muted">
              @{card.username ?? "creator"}
            </p>
          </div>
          {(canModerate || isOwner) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-md p-1 text-dash-surface-muted hover:bg-dash-navy/5" aria-label="Resource actions">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {card.status === "published" ? (
                  <DropdownMenuItem onClick={() => moderate("unpublished")}>
                    <EyeOff className="mr-2 h-4 w-4" /> Unpublish
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => moderate("published")}>
                    <Eye className="mr-2 h-4 w-4" /> Publish
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {card.description && (
          <p className="line-clamp-3 text-sm text-dash-surface-muted">{card.description}</p>
        )}

        {isClass && (
          <p className="text-xs text-dash-surface-muted">
            {(card.payload?.subject as string) ?? "Mathematics"}
            {typeof card.payload?.student_count === "number" && ` · ${card.payload.student_count} students`}
          </p>
        )}

        {card.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.hashtags.slice(0, 6).map((t) => (
              <span key={t} className="rounded-full bg-dash-navy/5 px-2 py-0.5 text-[11px] text-dash-surface-muted">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-3 text-xs text-dash-surface-muted">
            <button
              type="button"
              onClick={onToggleLike}
              className={`inline-flex items-center gap-1 transition hover:text-dash-gold ${liked ? "text-dash-gold" : ""}`}
              aria-label={liked ? "Unlike" : "Like"}
            >
              <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {card.like_count}
            </button>
            <span className="inline-flex items-center gap-1" title="Members currently using this">
              <Download className="h-4 w-4" /> {card.active_downloads}
            </span>
          </div>

          {(canDownload || isClass || isSession) && (
            <button
              type="button"
              onClick={act}
              disabled={busy}
              className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-dash-navy px-3.5 py-1.5 text-sm font-medium text-dash-surface transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isClass ? (
                <UserPlus className="h-4 w-4" />
              ) : isSession ? (
                <Radio className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {isClass
                ? "Request Access"
                : isSession
                  ? "Join Session"
                  : isLessonAsset
                    ? "Copy to My Asset Library"
                    : "Copy to My Workspace"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default CommunityResourceCard;
