/**
 * The Community feed — professional educational conversation.
 *
 * Posts are the one thing created inside Community. Teaching material is never
 * created here: it is made in the workspace and shared, and a post can point
 * at it.
 */
import { useState } from "react";
import CommunityShell from "@/components/community/CommunityShell";
import PostComposer from "@/components/community/PostComposer";
import PostCard from "@/components/community/PostCard";
import { useHashtagSuggestions } from "@/lib/community/usePosts";
import { useCommunityPosts, useMyUserId } from "@/lib/community/usePosts";
import { useCommunityRights } from "@/lib/community/useCommunity";
import { Link } from "@/lib/router-compat";

const CommunityFeedPage = ({ hashtag }: { hashtag?: string }) => {
  const rights = useCommunityRights();
  const myUserId = useMyUserId();
  const [search, setSearch] = useState("");
  const feed = useCommunityPosts({ hashtag, search: search.trim() || undefined });
  const trending = useHashtagSuggestions("");

  return (
    <CommunityShell
      active={hashtag ? "/community/feed" : "/community/feed"}
      title={hashtag ? `#${hashtag}` : "Community Feed"}
      subtitle={
        hashtag
          ? "Everything posted to Community under this topic."
          : "Updates, teaching ideas and announcements from teachers, schools, students and parents."
      }
      showSearch={false}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),260px]">
        <div className="space-y-5">
          {!hashtag && (
            <PostComposer
              canPromote={rights.canPublish}
              isPending={feed.publish.isPending}
              onPublish={(post) => feed.publish.mutate(post)}
            />
          )}

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search posts…"
            aria-label="Search posts"
            className="min-h-[42px] w-full rounded-full border border-white/15 bg-dash-navy/40 px-4 text-sm outline-none placeholder:text-dash-surface/40 focus:border-dash-gold/60"
          />

          {feed.isLoading ? (
            <p className="text-sm text-dash-surface/60">Loading the feed…</p>
          ) : feed.posts.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-dash-navy/30 p-4 text-sm text-dash-surface/65">
              Nothing here yet.
            </p>
          ) : (
            <div className="space-y-4">
              {feed.posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  liked={feed.likedIds.has(post.id)}
                  onToggleLike={() => feed.onToggleLike(post.id)}
                  canDelete={rights.canModerate || post.authorId === myUserId}
                  onDelete={() => feed.remove.mutate(post.id)}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-3 rounded-2xl border border-white/10 bg-dash-navy/30 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-dash-surface/55">
            Trending topics
          </h2>
          {trending.length === 0 ? (
            <p className="text-xs text-dash-surface/55">No topics yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {trending.map(({ tag, uses }) => (
                <li key={tag}>
                  <Link
                    to={`/community/tag/${encodeURIComponent(tag)}`}
                    className="flex items-center justify-between text-sm text-dash-surface/80 hover:text-dash-gold"
                  >
                    <span>#{tag}</span>
                    <span className="text-xs text-dash-surface/45">{uses}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </CommunityShell>
  );
};

export default CommunityFeedPage;
