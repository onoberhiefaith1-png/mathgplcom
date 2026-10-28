import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Copy, Download, Eye, EyeOff, Heart, Loader2, MoreVertical, Radio, Trash2, UserPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteResource, downloadResource, requestClassAccess, setResourceStatus } from "@/lib/community/community";
import { KIND_LABEL, type CommunityCard } from "@/lib/community/types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import NotebookCover from "@/components/lessonnotes/NotebookCover";
import { useSignedUrl } from "@/components/gamebuilder/SignedMedia";
import { sectionLabel } from "@/lib/lessonnotes/assets/customAssets";

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
  const isNote = card.kind === "lesson_note";
  const isAdventure = card.kind === "adventure";
  const isCourse = card.kind === "course";
  // A shared note, adventure or course is viewable before it is copied — the
  // creator's own cover artwork travels with the listing, and a course opens
  // the teacher's original course with its original videos.
  const viewPath = isNote
    ? `/community/note/${card.id}`
    : isAdventure
      ? `/community/adventure/${card.id}`
      : isCourse
        ? `/community/course/${card.id}`
        : null;

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
      } else if (res.kind === "course") {
        toast({ title: "Copied to your Courses", description: "It is yours now — edit it freely." });
        navigate(`/course-builder`);
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
  const coverPath =
    (card.payload?.cover_path as string | undefined) ??
    (card.payload?.storage_path as string | undefined) ??
    null;
  const signedCover = useSignedUrl(isAdventure ? coverPath : null);
  const payloadCover = isNote ? (card.payload?.cover as Record<string, unknown> | undefined) : undefined;
  // Listings published before covers travelled in the payload still show the
  // creator's real cover: read it straight from the shared notebook.
  const notebookId = (card.payload?.notebook_id as string | undefined) ?? card.source_id;
  const { data: fetchedCover } = useQuery({
    queryKey: ["community", "note-cover", notebookId],
    enabled: isNote && !payloadCover && !!notebookId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notebooks")
        .select("title, teacher, class_name, session, subject, subtopic, color_index, cover_config")
        .eq("id", notebookId!)
        .maybeSingle();
      return (data as Record<string, unknown> | null) ?? null;
    },
  });
  const noteCover = payloadCover ?? fetchedCover ?? undefined;

  const header = isNote && noteCover ? (
    <div className="w-32 shrink-0 self-start p-3">
      <NotebookCover
        notebook={{
          title: (noteCover.title as string) ?? card.title,
          teacher: (noteCover.teacher as string) ?? "",
          class_name: (noteCover.class_name as string) ?? "",
          session: (noteCover.session as string) ?? "",
          subject: (noteCover.subject as string) ?? "",
          subtopic: (noteCover.subtopic as string) ?? "",
          color_index: Number(noteCover.color_index ?? 0),
          cover_config: noteCover.cover_config,
        }}
        onClick={viewPath ? () => navigate(viewPath) : undefined}
      />
    </div>
  ) : signedCover || preview ? (
    <img
      src={signedCover ?? preview!}
      alt=""
      loading="lazy"
      className="h-32 w-full object-cover"
    />
  ) : (
    <div className="h-2 w-full bg-gradient-to-r from-dash-gold/70 to-dash-gold/20" />
  );

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-dash-border bg-dash-surface text-dash-surface-foreground shadow-[var(--shadow-dash)] transition hover:-translate-y-0.5">
      {header}

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

        {isLessonAsset && typeof card.payload?.section === "string" && (
          <p className="text-xs text-dash-surface-muted">
            {sectionLabel(String(card.payload.section))}
          </p>
        )}

        {isSession && (
          <div className="space-y-0.5 text-xs text-dash-surface-muted">
            {typeof card.payload?.schedule === "string" && <p>{card.payload.schedule}</p>}
            {typeof card.payload?.next_lesson === "string" && card.payload.next_lesson && (
              <p>Next lesson: {card.payload.next_lesson}</p>
            )}
            {typeof card.payload?.platforms === "string" && card.payload.platforms && (
              <p className="inline-flex items-center gap-1">
                <Radio className="h-3 w-3" /> {card.payload.platforms}
              </p>
            )}
          </div>
        )}

        {isCourse && (
          <p className="text-xs text-dash-surface-muted">
            {[card.payload?.subject, card.payload?.topic, card.payload?.subtopic]
              .filter((v) => typeof v === "string" && v)
              .join(" • ") || "Course"}
            {typeof card.payload?.section_count === "number" && ` · ${card.payload.section_count} sections`}
          </p>
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

          <div className="flex items-center gap-2">
          {viewPath && (
            <button
              type="button"
              onClick={() => navigate(viewPath)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-dash-navy/20 px-3 py-1.5 text-sm font-medium text-dash-surface-foreground transition hover:bg-dash-navy/5"
            >
              <Eye className="h-4 w-4" /> View
            </button>
          )}
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
      </div>
    </article>
  );
};

export default CommunityResourceCard;
