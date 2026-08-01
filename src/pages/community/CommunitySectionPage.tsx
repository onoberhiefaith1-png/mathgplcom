import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Home, Search } from "lucide-react";
import CommunityResourceCard from "@/components/community/CommunityResourceCard";
import { useCommunityFeed, useCommunityIdentity, useCommunityRights } from "@/lib/community/useCommunity";
import { useAccount } from "@/lib/accounts/useAccount";
import type { CommunitySection } from "@/lib/community/mode";
import type { CommunityKind } from "@/lib/community/types";

export type SectionTab = { kind: CommunityKind; label: string; subtitle?: string };

/**
 * One read-only section of the community mirror. It carries the same chrome as
 * the private workspace, but every card is somebody else's work: you can
 * preview it, like it, and copy it into your own workspace — nothing else.
 *
 * A section may hold several feeds (e.g. Lesson Notes + Lesson Notes Assets);
 * they appear as tabs on the very same page.
 */
const CommunitySectionPage = ({
  tabs,
  title,
  subtitle,
  workspacePath,
  backTo = "/community",
  backLabel = "MathGPL Community",
  siblings = [],
}: {
  /** One feed per tab; a single tab renders no switcher. */
  tabs: SectionTab[];
  title: string;
  subtitle: string;
  /** The private-workspace twin of this section. */
  workspacePath: string;
  backTo?: string;
  backLabel?: string;
  /** Sibling sections of the same pipeline, shown as in-page nav. */
  siblings?: readonly CommunitySection[];
}) => {
  const [search, setSearch] = useState("");
  const [tabIdx, setTabIdx] = useState(0);
  const active = tabs[Math.min(tabIdx, tabs.length - 1)]!;
  const { userId } = useAccount();
  const rights = useCommunityRights();
  const { username } = useCommunityIdentity();
  const { cards, isLoading, likedIds, onToggleLike, refetch } = useCommunityFeed({
    kind: active.kind,
    search,
    includeUnpublished: rights.canModerate,
  });

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(160deg,hsl(222_47%_11%),hsl(222_44%_16%))] text-dash-surface">
      <header className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={backTo}
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-dash-surface/70 transition hover:text-dash-surface"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-dash-surface/70">{active.subtitle ?? subtitle}</p>
            {username && (
              <p className="mt-1 text-xs text-dash-surface/50">Signed in as @{username}</p>
            )}
          </div>

          <Link
            to={workspacePath}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-dash-gold/40 bg-dash-navy/40 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-gold backdrop-blur transition hover:bg-dash-navy/60"
          >
            <Home className="h-3.5 w-3.5" /> My workspace
          </Link>
        </div>

        {tabs.length > 1 && (
          <div className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-dash-surface/20 bg-dash-surface/10 p-1 backdrop-blur">
            {tabs.map((tab, i) => (
              <button
                key={tab.kind}
                type="button"
                onClick={() => setTabIdx(i)}
                aria-current={i === tabIdx ? "true" : undefined}
                className={`min-h-[36px] rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  i === tabIdx
                    ? "bg-dash-gold text-dash-navy"
                    : "text-dash-surface/75 hover:text-dash-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {siblings.length > 0 && (
          <nav className="mt-4 flex flex-wrap gap-2">
            {siblings.map((s) => (
              <Link
                key={s.path}
                to={s.path}
                className="rounded-full border border-dash-surface/20 px-3 py-1.5 text-xs font-medium text-dash-surface/80 transition hover:border-dash-gold/50 hover:text-dash-surface"
              >
                {s.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6">
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
            <p className="text-base font-semibold">Nothing shared here yet</p>
            <p className="mt-1 text-sm text-dash-surface/70">
              Anything shared with MathGPL Community from a private workspace appears here.
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
                onChanged={() => {
                  void refetch();
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CommunitySectionPage;
