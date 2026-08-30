/**
 * Main Community — the discovery layer.
 *
 * Community aggregates what many people have chosen to publish from their own
 * Teaching Hubs. Nothing is created or owned here: every card is a reference to
 * somebody's original asset, and the page is built to feel alive — featured
 * work, rails per content type, and a stream that keeps loading.
 */
import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import {
  ArrowRight,
  BookOpen,
  Flame,
  GraduationCap,
  Loader2,
  MessageSquare,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import CommunityShell from "@/components/community/CommunityShell";
import PersonResultCard from "@/components/community/PersonResultCard";
import CommunityResourceCard from "@/components/community/CommunityResourceCard";
import LiveNowRail from "@/components/community/LiveNowRail";
import PostCard from "@/components/community/PostCard";
import { ROLE_PLURAL, type CommunityRoleKind } from "@/lib/community/people";
import { useCommunityPeople, useCommunityRequests } from "@/lib/community/usePeople";
import { useCommunityRights, useCommunityStream } from "@/lib/community/useCommunity";
import { useCommunityPosts, useMyUserId } from "@/lib/community/usePosts";
import { COMMUNITY_KINDS, type CommunityCard, type CommunityKind } from "@/lib/community/types";

const ROLE_PATH: Record<CommunityRoleKind, string> = {
  teacher: "/community/teachers",
  school: "/community/schools",
  student: "/community/students",
  parent: "/community/parents",
};

/** The content types Community surfaces as rails, in reading order. */
const RAILS: { label: string; to: string; kinds: CommunityKind[]; Icon: typeof BookOpen }[] = [
  { label: "Lesson Notes", to: "/community/lesson-notes", kinds: ["lesson_note", "lesson_asset"], Icon: BookOpen },
  { label: "Courses", to: "/community/courses", kinds: ["course"], Icon: GraduationCap },
  { label: "Classes", to: "/community/classes", kinds: ["class"], Icon: Users },
  { label: "Adventures", to: "/community/adventure", kinds: ["adventure"], Icon: Sparkles },
  { label: "Live", to: "/community/live", kinds: ["session"], Icon: Radio },
];

const FILTERS: { label: string; kinds?: CommunityKind[] }[] = [
  { label: "Everything" },
  { label: "Lesson Notes", kinds: ["lesson_note", "lesson_asset"] },
  { label: "Courses", kinds: ["course"] },
  { label: "Classes", kinds: ["class"] },
  { label: "Adventures", kinds: ["adventure"] },
  { label: "Live", kinds: ["session"] },
];

const SectionHeader = ({
  title,
  to,
  Icon,
}: {
  title: string;
  to?: string;
  Icon?: typeof BookOpen;
}) => (
  <div className="flex items-end justify-between gap-3">
    <h2 className="flex items-center gap-2 text-lg font-semibold">
      {Icon && <Icon className="h-4 w-4 text-dash-gold" />}
      {title}
    </h2>
    {to && (
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-dash-gold"
      >
        View all <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    )}
  </div>
);

const KIND_LABELS = COMMUNITY_KINDS.reduce<Record<string, string>>(
  (acc, k) => ({ ...acc, [k.kind]: k.label }),
  {},
);

/** A wide, image-forward card for the one piece Community is leading with. */
const FeaturedCard = ({ card }: { card: CommunityCard }) => {
  const cover = (card.payload?.preview_url as string | undefined) ?? null;
  return (
    <article className="overflow-hidden rounded-3xl border border-dash-gold/30 bg-dash-navy/50">
      <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr),1.1fr]">
        <div className="min-h-[160px] bg-gradient-to-br from-dash-gold/30 to-dash-navy/60">
          {cover && <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-col gap-2 p-5">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-dash-gold">
            <Flame className="h-3.5 w-3.5" /> Featured · {KIND_LABELS[card.kind] ?? "Shared"}
          </p>
          <h3 className="text-xl font-semibold">{card.title}</h3>
          <p className="text-xs text-dash-surface/60">@{card.username ?? "creator"}</p>
          {card.description && (
            <p className="line-clamp-3 text-sm text-dash-surface/75">{card.description}</p>
          )}
          <Link
            to={card.username ? `/community/people/${card.username}` : "/community/network"}
            className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-dash-gold/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-dash-gold"
          >
            Visit creator <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
};

const PeopleRail = ({ role }: { role: CommunityRoleKind }) => {
  const { people, isLoading } = useCommunityPeople(role, "");
  const { stateFor } = useCommunityRequests();
  const shown = people.slice(0, 3);

  return (
    <section className="space-y-3">
      <SectionHeader title={`Popular ${ROLE_PLURAL[role]}`} to={ROLE_PATH[role]} />
      {isLoading ? (
        <p className="text-sm text-dash-surface/60">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-dash-navy/30 p-4 text-sm text-dash-surface/65">
          No {ROLE_PLURAL[role].toLowerCase()} have a public Community presence yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((person) => (
            <PersonResultCard key={person.userId} person={person} state={stateFor(person)} />
          ))}
        </div>
      )}
    </section>
  );
};

const CommunityNetworkPage = () => {
  const rights = useCommunityRights();
  const myUserId = useMyUserId();
  const [filterIdx, setFilterIdx] = useState(0);
  const filter = FILTERS[Math.min(filterIdx, FILTERS.length - 1)]!;

  const stream = useCommunityStream(filter.kinds ? { kinds: filter.kinds } : {});
  const posts = useCommunityPosts();

  const cardProps = (card: CommunityCard) => ({
    card,
    liked: stream.likedIds.has(card.id),
    onToggleLike: () => stream.onToggleLike(card.id),
    canDownload: rights.canDownload,
    canModerate: rights.canModerate,
    isOwner: card.owner_id === myUserId,
    onChanged: () => void stream.refetch(),
  });

  const featured = useMemo(
    () => [...stream.cards].sort((a, b) => b.like_count - a.like_count)[0] ?? null,
    [stream.cards],
  );
  const recent = stream.cards.slice(0, 6);

  return (
    <CommunityShell
      active="/community/network"
      title="Community"
      subtitle="Discover what's happening across MathGPL right now — shared lesson notes, courses, classes, adventures and live teaching."
    >
      <div className="space-y-10">
        <LiveNowRail />

        {featured && (
          <section className="space-y-3">
            <SectionHeader title="Featured" />
            <FeaturedCard card={featured} />
          </section>
        )}

        <section className="space-y-3">
          <SectionHeader title="Recently shared" />
          {stream.isLoading ? (
            <p className="text-sm text-dash-surface/60">Loading Community…</p>
          ) : recent.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-dash-navy/30 p-4 text-sm text-dash-surface/65">
              Nothing has been shared yet. Material is created in a Teaching Hub and appears here once its owner shares it.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recent.map((card) => (
                <CommunityResourceCard key={card.id} {...cardProps(card)} />
              ))}
            </div>
          )}
        </section>

        {RAILS.map(({ label, to, kinds, Icon }) => {
          const rail = stream.cards.filter((card) => kinds.includes(card.kind)).slice(0, 3);
          if (rail.length === 0) return null;
          return (
            <section key={label} className="space-y-3">
              <SectionHeader title={label} to={to} Icon={Icon} />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rail.map((card) => (
                  <CommunityResourceCard key={card.id} {...cardProps(card)} />
                ))}
              </div>
            </section>
          );
        })}

        {(["teacher", "school", "student", "parent"] as CommunityRoleKind[]).map((role) => (
          <PeopleRail key={role} role={role} />
        ))}

        <section className="space-y-3">
          <SectionHeader title="From the Community" to="/community/feed" Icon={MessageSquare} />
          {posts.posts.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-dash-navy/30 p-4 text-sm text-dash-surface/65">
              No posts yet. The feed fills up as educators share what they are working on.
            </p>
          ) : (
            <div className="space-y-4">
              {posts.posts.slice(0, 3).map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  liked={posts.likedIds.has(post.id)}
                  onToggleLike={() => posts.onToggleLike(post.id)}
                  canDelete={rights.canModerate || post.authorId === myUserId}
                  onDelete={() => posts.remove.mutate(post.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <SectionHeader title="Keep browsing" />
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f, idx) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setFilterIdx(idx)}
                className={`min-h-[38px] rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  idx === filterIdx
                    ? "border-dash-gold bg-dash-gold/15 text-dash-gold"
                    : "border-white/15 text-dash-surface/70 hover:text-dash-surface"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stream.cards.map((card) => (
              <CommunityResourceCard key={`stream-${card.id}`} {...cardProps(card)} />
            ))}
          </div>

          {stream.hasMore && (
            <button
              type="button"
              onClick={stream.loadMore}
              disabled={stream.isFetchingMore}
              className="mx-auto flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 px-6 text-sm font-semibold text-dash-surface transition hover:bg-white/5 disabled:opacity-60"
            >
              {stream.isFetchingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              Show more
            </button>
          )}
        </section>
      </div>
    </CommunityShell>
  );
};

export default CommunityNetworkPage;
