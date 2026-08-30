/**
 * Global Community search — people and content in one place.
 *
 * Results stay compact: a person card links to the full profile, a content card
 * links to the original resource in its owner's workspace.
 */
import { useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "@/lib/router-compat";
import CommunityShell from "@/components/community/CommunityShell";
import PersonResultCard from "@/components/community/PersonResultCard";
import CommunityResourceCard from "@/components/community/CommunityResourceCard";
import { COMMUNITY_ROLES, type CommunityPerson, type CommunityRoleKind } from "@/lib/community/people";
import { useCommunityPeople, useCommunityRequests } from "@/lib/community/usePeople";
import { useCommunityFeed, useCommunityRights } from "@/lib/community/useCommunity";

type Tab = "all" | "content" | CommunityRoleKind;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  ...COMMUNITY_ROLES.map(({ kind, plural }) => ({ key: kind as Tab, label: plural })),
  { key: "content", label: "Content" },
];

const CommunitySearchPage = () => {
  const [params] = useSearchParams();
  const query = params.get("q") ?? "";
  const [tab, setTab] = useState<Tab>("all");

  const role = tab === "all" || tab === "content" ? null : tab;
  const { people, isLoading } = useCommunityPeople(role, query);
  const rights = useCommunityRights();
  const content = useCommunityFeed({ search: query || undefined });
  const { stateFor, send } = useCommunityRequests();

  const request = (person: CommunityPerson) =>
    send.mutate(person, {
      onSuccess: () => toast.success(`Request sent to ${person.displayName}.`),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Could not send that request."),
    });

  const showPeople = tab !== "content";
  const showContent = tab === "all" || tab === "content";

  return (
    <CommunityShell
      active="/community/search"
      title={query ? `Results for “${query}”` : "Search Community"}
      subtitle="People, educational content, topics and hashtags."
      initialQuery={query}
    >
      <div className="flex flex-wrap gap-2 pb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`min-h-[38px] rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.12em] transition ${
              tab === key
                ? "border-dash-gold bg-dash-gold text-dash-navy"
                : "border-white/20 text-dash-surface/80 hover:bg-white/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-10">
        {showPeople && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">People</h2>
            {isLoading ? (
              <p className="text-sm text-dash-surface/60">Loading…</p>
            ) : people.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-dash-navy/30 p-4 text-sm text-dash-surface/65">
                No listed people match this search.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {people.map((person) => (
                  <PersonResultCard
                    key={person.userId}
                    person={person}
                    state={stateFor(person)}
                    onRequest={request}
                    requesting={send.isPending && send.variables?.userId === person.userId}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {showContent && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Educational content</h2>
            {content.cards.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-dash-navy/30 p-4 text-sm text-dash-surface/65">
                No shared content matches this search yet.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {content.cards.map((card) => (
                  <CommunityResourceCard
                    key={card.id}
                    card={card}
                    liked={content.likedIds.has(card.id)}
                    onToggleLike={() => content.onToggleLike(card.id)}
                    canDownload={rights.canDownload}
                    canModerate={rights.canModerate}
                    isOwner={false}
                    onChanged={() => content.refetch()}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </CommunityShell>
  );
};

export default CommunitySearchPage;
