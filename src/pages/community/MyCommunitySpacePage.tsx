/**
 * My Dashboard — the ownership layer.
 *
 * This is the only place in Community where the signed-in person can act on
 * their own presence: their professional profile, the material they have
 * shared, and their own posts. Editing lives here and nowhere else; every
 * other Community surface is read-only.
 */
import { Link } from "@/lib/router-compat";
import { AlertCircle, ExternalLink, Eye, Pencil } from "lucide-react";
import PersonalDashboardShell from "@/components/community/PersonalDashboardShell";
import CommunityResourceCard from "@/components/community/CommunityResourceCard";
import PostComposer from "@/components/community/PostComposer";
import PostCard from "@/components/community/PostCard";
import { useMyCommunityProfile } from "@/lib/community/usePeople";
import { useCommunityFeed, useCommunityRights } from "@/lib/community/useCommunity";
import { useCommunityPosts, useMyUserId } from "@/lib/community/usePosts";
import { SHARED_GROUPS } from "@/lib/community/groups";
import { missingProfilePieces, profileCompleteness } from "@/lib/community/people";

const MyCommunitySpacePage = () => {
  const { data: profile, isLoading } = useMyCommunityProfile();
  const rights = useCommunityRights();
  const myUserId = useMyUserId();
  const shared = useCommunityFeed({ ownerId: myUserId ?? "none" });
  const feed = useCommunityPosts({ authorId: myUserId ?? "none" });

  const editable = profile
    ? (() => {
        const { userId: _u, moderationState: _s, moderationReason: _r, ...rest } = profile;
        return rest;
      })()
    : null;
  const completeness = editable ? profileCompleteness(editable) : 0;
  const missing = editable ? missingProfilePieces(editable) : [];

  return (
    <PersonalDashboardShell
      active="/community/dashboard"
      title="My Dashboard"
      subtitle="My content: my profile, my lesson notes, courses, adventures, classes and live lessons, and everything I have shared."
    >
      <div className="space-y-8">
        <section className="rounded-2xl border border-white/10 bg-dash-navy/40 p-5">
          {isLoading ? (
            <p className="text-sm text-dash-surface/60">Loading your profile…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">
                    {profile?.displayName || "Your Community profile"}
                  </h2>
                  <p className="text-sm text-dash-surface/70">
                    {profile?.username ? `@${profile.username}` : "No Community username yet"}
                  </p>
                  <p className="mt-2 text-xs text-dash-surface/60">
                    {profile?.isListed
                      ? "Listed — people can find you in Community."
                      : "Not listed — you are invisible in Community until you switch listing on."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/account/community-profile"
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-dash-gold px-4 text-xs font-semibold uppercase tracking-[0.14em] text-dash-navy"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit profile
                  </Link>
                  {profile?.username && (
                    <Link
                      to={`/community/people/${profile.username}`}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface/80"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View public profile
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-dash-gold" style={{ width: `${completeness}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-dash-surface/60">
                  {completeness}% complete — nothing here is required.
                </p>
                {missing.length > 0 && (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-dash-surface/55">
                    <AlertCircle className="h-3.5 w-3.5 text-dash-gold" />
                    Still to add: {missing.join(", ")}
                  </p>
                )}
              </div>

              {profile?.moderationState === "rejected" && profile.moderationReason && (
                <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {profile.moderationReason}
                </p>
              )}
            </>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Post to Community</h2>
          <PostComposer
            canPromote={rights.canPublish}
            isPending={feed.publish.isPending}
            onPublish={(post) => feed.publish.mutate(post)}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">My posts</h2>
          {feed.posts.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-dash-navy/30 p-4 text-sm text-dash-surface/65">
              You have not posted yet.
            </p>
          ) : (
            <div className="space-y-4">
              {feed.posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  liked={feed.likedIds.has(post.id)}
                  onToggleLike={() => feed.onToggleLike(post.id)}
                  canDelete
                  onDelete={() => feed.remove.mutate(post.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">My Community Dashboard</h2>
              <p className="text-xs text-dash-surface/60">
                Only what I have deliberately shared. Everything else stays private in my Teaching Hub.
              </p>
            </div>
            <span className="flex items-center gap-1 text-xs text-dash-surface/55">
              <Eye className="h-3.5 w-3.5" /> {shared.cards.length} listings
            </span>
          </div>
          {shared.cards.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-dash-navy/30 p-4 text-sm text-dash-surface/65">
              You have no public Community presence yet — and you never have to. Share a lesson note, course, class,
              adventure or live room from your Teaching Hub and it appears here.
            </p>
          ) : (
            SHARED_GROUPS.map(({ label, kinds }) => {
              const group = shared.cards.filter((card) => kinds.includes(card.kind));
              if (group.length === 0) return null;
              return (
                <div key={label} className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-surface/60">
                    {label}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {group.map((card) => (
                      <CommunityResourceCard
                        key={card.id}
                        card={card}
                        liked={shared.likedIds.has(card.id)}
                        onToggleLike={() => shared.onToggleLike(card.id)}
                        canDownload={rights.canDownload}
                        canModerate={rights.canModerate}
                        isOwner
                        onChanged={() => shared.refetch()}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>

      </div>
    </PersonalDashboardShell>
  );
};

export default MyCommunitySpacePage;
