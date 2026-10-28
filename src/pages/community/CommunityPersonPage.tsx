/**
 * The full Community profile — the depth a search result deliberately withholds.
 */
import { toast } from "sonner";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, Eye, MapPin, Pencil } from "lucide-react";
import CommunityShell from "@/components/community/CommunityShell";
import CommunityResourceCard from "@/components/community/CommunityResourceCard";
import { useCommunityFeed, useCommunityRights } from "@/lib/community/useCommunity";
import { useCommunityPerson, useCommunityRequests } from "@/lib/community/usePeople";
import { requestStateLabel } from "@/lib/community/requests";
import { ROLE_PLURAL, type ProfessionalDetails } from "@/lib/community/people";
import { useCommunityPosts, useMyUserId } from "@/lib/community/usePosts";
import PostCard from "@/components/community/PostCard";
import { useCommunityMediaUrl } from "@/lib/community/media";
import { SHARED_GROUPS } from "@/lib/community/groups";



const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-white/10 bg-dash-navy/30 p-5">
    <h2 className="pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-dash-surface/55">{title}</h2>
    {children}
  </section>
);

const Chips = ({ values }: { values?: string[] }) =>
  values && values.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-dash-surface/85"
        >
          {value}
        </span>
      ))}
    </div>
  ) : null;

const Lines = ({ values }: { values?: string[] }) =>
  values && values.length > 0 ? (
    <ul className="space-y-1.5 text-sm text-dash-surface/80">
      {values.map((value) => (
        <li key={value}>• {value}</li>
      ))}
    </ul>
  ) : null;

const hasAny = (...groups: (string[] | string | undefined)[]) =>
  groups.some((group) => (Array.isArray(group) ? group.length > 0 : Boolean(group)));




const CommunityPersonPage = () => {
  const params = useParams() as { username?: string };
  const username = params.username;
  const { person, isLoading, error } = useCommunityPerson(username);
  const { stateFor, send } = useCommunityRequests();
  const myUserId = useMyUserId();
  const isOwner = Boolean(person && myUserId && person.userId === myUserId);

  // Everything this person has shared into Community, from their own listings.
  const rights = useCommunityRights();
  const { cards, likedIds, onToggleLike, refetch } = useCommunityFeed(
    person ? { ownerId: person.userId } : { ownerId: "none" },
  );
  const feed = useCommunityPosts(person ? { authorId: person.userId } : { authorId: "none" });

  const pro: ProfessionalDetails = person?.professional ?? {};

  // Uploaded media is stored privately; resolve it into displayable links.
  const coverSrc = useCommunityMediaUrl(person?.coverUrl);
  const avatarSrc = useCommunityMediaUrl(person?.avatarUrl);
  const introSrc = useCommunityMediaUrl(person?.introVideoUrl);


  return (
    <CommunityShell
      active="/community/network"
      title={person ? `${person.displayName}'s MathGPL space` : isLoading ? "Loading profile…" : "Profile"}
      subtitle={
        person
          ? person.headline ?? "Publicly shared material from this account. View or copy — nothing here can be edited."
          : undefined
      }
      showSearch={false}
    >
      <Link
        to="/community/network"
        className="mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-dash-surface/65 hover:text-dash-surface"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Community
      </Link>


      {error && (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error.message}</p>
      )}

      {!isLoading && !person && !error && (
        <p className="rounded-2xl border border-white/10 bg-dash-navy/30 p-6 text-sm text-dash-surface/75">
          This profile is not listed in Community.
        </p>
      )}

      {person && (
        <div className="space-y-5">
          {coverSrc && (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {person.coverKind === "video" ? (
                <video
                  src={coverSrc}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-40 w-full object-cover sm:h-56"
                />
              ) : (
                <img
                  src={coverSrc}
                  alt={`${person.displayName} cover`}
                  className="h-40 w-full object-cover sm:h-56"
                />
              )}
            </div>
          )}

          <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-dash-navy/40 p-5 sm:flex-row sm:items-start">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={`${person.displayName} profile photo`}
                className="h-28 w-28 shrink-0 rounded-3xl object-cover"
              />

            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl bg-dash-gold/15 text-2xl font-semibold text-dash-gold">
                {person.displayName.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-semibold">{person.displayName}</h2>
              <p className="text-sm text-dash-surface/70">@{person.username}</p>
              {person.headline && <p className="mt-1 text-sm text-dash-surface/85">{person.headline}</p>}
              <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-dash-surface/55">
                {(person.location || person.country) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[person.location, person.country].filter(Boolean).join(" / ")}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {person.viewCount} views
                </span>
                {person.roleKind && <span>{ROLE_PLURAL[person.roleKind].replace(/s$/, "")}</span>}
                {pro.onlineAvailability && <span>{pro.onlineAvailability}</span>}
              </p>
              {person.bio && <p className="mt-3 text-sm text-dash-surface/80">{person.bio}</p>}
            </div>

            {/* Only the owner edits a profile; everyone else can only connect. */}
            {isOwner ? (
              <Link
                to="/account/community-profile"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-dash-gold/50 px-5 text-sm font-semibold text-dash-gold transition hover:bg-dash-navy/60"
              >
                <Pencil className="h-4 w-4" /> Edit my profile
              </Link>
            ) : (
              <button
                type="button"
                disabled={stateFor(person) !== "none" || send.isPending}
                onClick={() =>
                  send.mutate(person, {
                    onSuccess: () => toast.success(`Request sent to ${person.displayName}.`),
                    onError: (mutationError) =>
                      toast.error(
                        mutationError instanceof Error ? mutationError.message : "Could not send that request.",
                      ),
                  })
                }
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-dash-gold px-5 text-sm font-semibold text-dash-navy transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {send.isPending ? "Sending…" : requestStateLabel(stateFor(person))}
              </button>
            )}
          </header>

          {person.metrics && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: "Shared", value: person.metrics.shared },
                { label: "Students", value: person.metrics.students },
                { label: "Likes", value: person.metrics.likes },
                { label: "Posts", value: person.metrics.posts },
                { label: "Live lessons", value: person.metrics.live },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-dash-navy/40 p-3 text-center">
                  <p className="text-lg font-semibold text-dash-surface">{stat.value}</p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-dash-surface/55">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {introSrc && (
            <Section title="Introduction">
              <video
                src={introSrc}

                controls
                preload="metadata"
                className="w-full rounded-xl border border-white/10"
              />
            </Section>
          )}


          {person.bioLong && (
            <Section title="About">
              <p className="whitespace-pre-line text-sm text-dash-surface/85">{person.bioLong}</p>
            </Section>
          )}

          {hasAny(pro.degrees, pro.institutions) && (
            <Section title="Education">
              <Lines values={[...(pro.degrees ?? []), ...(pro.institutions ?? [])]} />
            </Section>
          )}

          {hasAny(pro.qualifications, pro.certifications) && (
            <Section title="Qualifications">
              <Lines values={[...(pro.qualifications ?? []), ...(pro.certifications ?? [])]} />
            </Section>
          )}

          {hasAny(pro.currentRole, pro.previousRoles, pro.experience, person.yearsExperience ? "y" : undefined) && (
            <Section title="Experience">
              {person.yearsExperience != null && (
                <p className="pb-2 text-sm text-dash-surface/80">{person.yearsExperience} years of experience</p>
              )}
              <Lines
                values={
                  [pro.currentRole, ...(pro.experience ?? []), ...(pro.previousRoles ?? [])].filter(
                    Boolean,
                  ) as string[]
                }
              />
            </Section>
          )}

          {hasAny(pro.languages) && (
            <Section title="Languages">
              <Chips values={pro.languages} />
            </Section>
          )}

          {hasAny(pro.links, pro.website) && (
            <Section title="Links">
              <ul className="space-y-1.5 text-sm">
                {[pro.website, ...(pro.links ?? [])].filter(Boolean).map((link) => (
                  <li key={link}>
                    <a
                      href={link as string}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-dash-gold hover:underline"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}


          {hasAny(pro.subjects, pro.levels, pro.curricula, pro.programmes, pro.schoolType) && (
            <Section title="Subjects and teaching">
              <div className="space-y-3">
                <Chips values={pro.subjects} />
                <Chips values={pro.levels} />
                <Chips values={pro.curricula} />
                <Chips values={pro.programmes} />
                {pro.schoolType && <p className="text-sm text-dash-surface/80">{pro.schoolType}</p>}
              </div>
            </Section>
          )}

          {hasAny(pro.skills, pro.expertise, pro.interests, pro.achievements) && (
            <Section title="Skills and interests">
              <div className="space-y-3">
                <Chips values={pro.skills} />
                <Chips values={pro.expertise} />
                <Chips values={pro.interests} />
                <Lines values={pro.achievements} />
              </div>
            </Section>
          )}

          {SHARED_GROUPS.map(({ label, kinds }) => {
            const group = cards.filter((card) => kinds.includes(card.kind));
            if (group.length === 0) return null;
            return (
              <Section key={label} title={label}>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.map((card) => (
                    <CommunityResourceCard
                      key={card.id}
                      card={card}
                      liked={likedIds.has(card.id)}
                      onToggleLike={() => onToggleLike(card.id)}
                      canDownload={rights.canDownload}
                      canModerate={rights.canModerate}
                      isOwner={false}
                      onChanged={() => refetch()}
                    />
                  ))}
                </div>
              </Section>
            );
          })}

          {cards.length === 0 && (
            <Section title="Shared material">
              <p className="text-sm text-dash-surface/65">
                Nothing shared to Community yet. Anything this account shares from its workspace appears here.
              </p>
            </Section>
          )}

          <Section title="Activity">
            {feed.posts.length === 0 ? (
              <p className="text-sm text-dash-surface/65">No posts yet.</p>
            ) : (
              <div className="space-y-4">
                {feed.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    liked={feed.likedIds.has(post.id)}
                    onToggleLike={() => feed.onToggleLike(post.id)}
                    canDelete={isOwner || rights.canModerate}
                    onDelete={() => feed.remove.mutate(post.id)}
                  />
                ))}
              </div>
            )}
          </Section>

        </div>
      )}
    </CommunityShell>
  );
};

export default CommunityPersonPage;
