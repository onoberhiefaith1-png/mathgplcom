/**
 * One post in the Community feed.
 *
 * A post is professional conversation: text, optional media, a category, and
 * hashtags that lead to more of the same topic. Likes and comments are open to
 * every signed-in member; deleting is the author's (or a moderator's) alone.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@/lib/router-compat";
import { Eye, Heart, MessageSquare, Trash2 } from "lucide-react";
import { usePostComments } from "@/lib/community/usePosts";
import type { CommunityPost } from "@/lib/community/posts";
import { useCommunityMediaUrl } from "@/lib/community/media";


const timeAgo = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const PostCard = ({
  post,
  liked,
  onToggleLike,
  canDelete,
  onDelete,
}: {
  post: CommunityPost;
  liked: boolean;
  onToggleLike: () => void;
  canDelete: boolean;
  onDelete?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { comments, add, remove } = usePostComments(post.id, open);
  const avatarSrc = useCommunityMediaUrl(post.avatarUrl);

  return (
    <article className="rounded-2xl border border-white/10 bg-dash-navy/40 p-5">
      <header className="flex items-start gap-3">
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="h-11 w-11 rounded-2xl object-cover" />

        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-dash-gold/15 text-sm font-semibold text-dash-gold">
            {post.displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {post.username ? (
            <Link
              to={`/community/people/${post.username}`}
              className="text-sm font-semibold text-dash-surface hover:text-dash-gold"
            >
              {post.displayName}
            </Link>
          ) : (
            <p className="text-sm font-semibold text-dash-surface">{post.displayName}</p>
          )}
          {post.headline && <p className="truncate text-xs text-dash-surface/60">{post.headline}</p>}
          <p className="mt-0.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-dash-surface/45">
            <span>{timeAgo(post.createdAt)}</span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 tracking-normal normal-case">
              {post.category}
            </span>
            {post.isPromotion && (
              <span className="rounded-full border border-dash-gold/40 px-2 py-0.5 tracking-normal normal-case text-dash-gold">
                Promotion
              </span>
            )}
          </p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete post"
            className="rounded-lg border border-white/10 p-2 text-dash-surface/60 transition hover:border-red-400/50 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      <p className="mt-3 whitespace-pre-line text-sm text-dash-surface/90">{post.body}</p>

      {post.mediaUrl && post.mediaKind === "image" && (
        <img src={post.mediaUrl} alt="" className="mt-3 w-full rounded-xl object-cover" loading="lazy" />
      )}
      {post.mediaUrl && post.mediaKind === "video" && (
        <video src={post.mediaUrl} controls className="mt-3 w-full rounded-xl" preload="metadata" />
      )}

      {post.promotionUrl && (
        <a
          href={post.promotionUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex min-h-[40px] items-center rounded-full border border-dash-gold/45 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-dash-gold"
        >
          Open link
        </a>
      )}

      {post.hashtags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.hashtags.map((tag) => (
            <Link
              key={tag}
              to={`/community/tag/${encodeURIComponent(tag)}`}
              className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs text-dash-surface/80 transition hover:border-dash-gold/50 hover:text-dash-gold"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center gap-4 text-xs text-dash-surface/60">
        <button
          type="button"
          onClick={onToggleLike}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 transition ${
            liked ? "border-dash-gold/50 text-dash-gold" : "border-white/12 hover:text-dash-surface"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} /> {post.likeCount}
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/12 px-3 transition hover:text-dash-surface"
        >
          <MessageSquare className="h-3.5 w-3.5" /> {post.commentCount}
        </button>
        <span className="inline-flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" /> {post.viewCount}
        </span>
      </footer>

      {open && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          {comments.length === 0 ? (
            <p className="text-xs text-dash-surface/55">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-xl bg-white/5 p-3">
                <p className="text-sm text-dash-surface/85">{comment.body}</p>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-dash-surface/45">
                  <span>{timeAgo(comment.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => remove.mutate(comment.id)}
                    className="hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.trim()) return;
              add.mutate(draft, {
                onSuccess: () => setDraft(""),
                onError: (error) =>
                  toast.error(error instanceof Error ? error.message : "Could not add that comment."),
              });
            }}
            className="flex items-center gap-2"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a comment…"
              aria-label="Write a comment"
              className="min-h-[40px] w-full rounded-full border border-white/15 bg-dash-navy/50 px-4 text-sm outline-none placeholder:text-dash-surface/40 focus:border-dash-gold/60"
            />
            <button
              type="submit"
              disabled={add.isPending}
              className="inline-flex min-h-[40px] shrink-0 items-center rounded-full bg-dash-gold px-4 text-xs font-semibold text-dash-navy disabled:opacity-60"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </article>
  );
};

export default PostCard;
