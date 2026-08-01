import { useState } from "react";
import { Search } from "lucide-react";
import CommunityShell from "@/components/community/CommunityShell";
import CommunityResourceCard from "@/components/community/CommunityResourceCard";
import { useCommunityFeed, useCommunityRights } from "@/lib/community/useCommunity";
import { useAccount } from "@/lib/accounts/useAccount";
import type { CommunityKind } from "@/lib/community/types";

/**
 * One browse surface used by Discover (no kind) and by every section.
 * Search ranks hashtag matches first, then title, then description.
 */
const CommunityBrowsePage = ({
  kind,
  title,
  subtitle,
}: {
  kind?: CommunityKind;
  title: string;
  subtitle?: string;
}) => {
  const [search, setSearch] = useState("");
  const { userId } = useAccount();
  const rights = useCommunityRights();
  const { cards, isLoading, likedIds, onToggleLike, refetch } = useCommunityFeed({
    kind,
    search,
    includeUnpublished: rights.canModerate,
  });

  return (
    <CommunityShell title={title} subtitle={subtitle} activeKind={kind}>
      <div className="mb-6 flex items-center gap-2 rounded-full border border-dash-surface/20 bg-dash-surface/10 px-4 py-2 backdrop-blur">
        <Search className="h-4 w-4 text-dash-surface/70" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hashtags, titles or creators — e.g. #Algebra"
          className="min-h-[28px] w-full bg-transparent text-sm text-dash-surface placeholder:text-dash-surface/50 outline-hidden"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-dash-surface/70">Loading community…</p>
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-10 text-center">
          <p className="text-base font-semibold">Nothing here yet</p>
          <p className="mt-1 text-sm text-dash-surface/70">
            {rights.canPublish
              ? "Publish something from your workspace and it will appear here."
              : "Check back soon — teachers are still publishing."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <CommunityResourceCard
              key={card.id}
              card={card}
              liked={likedIds.has(card.id)}
              onToggleLike={() => onToggleLike(card.id)}
              canDownload={rights.canDownload}
              canModerate={rights.canModerate}
              isOwner={card.owner_id === userId}
              onChanged={() => { void refetch(); }}
            />
          ))}
        </div>
      )}
    </CommunityShell>
  );
};

export default CommunityBrowsePage;
