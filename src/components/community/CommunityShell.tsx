import { useState, type ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, AtSign, Globe2 } from "lucide-react";
import UsernameDialog from "./UsernameDialog";
import { useCommunityIdentity, useCommunityRights } from "@/lib/community/useCommunity";
import { COMMUNITY_KINDS } from "@/lib/community/types";

/**
 * Community deliberately wears the same chrome as the member's own workspace:
 * navy canvas, white elevated cards, gold accents. Only the content is shared.
 */
const CommunityShell = ({
  title,
  subtitle,
  activeKind,
  children,
}: {
  title: string;
  subtitle?: string;
  activeKind?: string;
  children: ReactNode;
}) => {
  const { username, refetch } = useCommunityIdentity();
  const { isStudent } = useCommunityRights();
  const [askUsername, setAskUsername] = useState(false);

  // Students browse public classes and permitted resources only.
  const sections = isStudent
    ? COMMUNITY_KINDS.filter((k) => k.kind === "class" || k.kind === "lesson_note")
    : COMMUNITY_KINDS;

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(160deg,hsl(222_47%_11%),hsl(222_44%_16%))] text-dash-surface">
      <header className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-dash-surface/70 transition hover:text-dash-surface"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> MathGPL
            </Link>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              <Globe2 className="h-6 w-6 text-dash-gold" /> {title}
            </h1>
            {subtitle && <p className="mt-1 max-w-2xl text-sm text-dash-surface/70">{subtitle}</p>}
          </div>

          <button
            type="button"
            onClick={() => setAskUsername(true)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-dash-gold/40 bg-dash-navy/40 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-gold backdrop-blur transition hover:bg-dash-navy/60"
          >
            <AtSign className="h-3.5 w-3.5" />
            {username ?? "Choose username"}
          </button>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/community"
            aria-current={activeKind ? undefined : "page"}
            className={`rounded-full border px-4 py-1.5 text-sm backdrop-blur transition ${
              activeKind
                ? "border-dash-surface/20 bg-dash-surface/10 text-dash-surface/85 hover:bg-dash-surface/20"
                : "border-dash-gold/60 bg-dash-surface/20 text-dash-surface"
            }`}
          >
            Discover
          </Link>
          {sections.map((s) => (
            <Link
              key={s.kind}
              to={`/community/${s.kind}`}
              aria-current={activeKind === s.kind ? "page" : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm backdrop-blur transition ${
                activeKind === s.kind
                  ? "border-dash-gold/60 bg-dash-surface/20 text-dash-surface"
                  : "border-dash-surface/20 bg-dash-surface/10 text-dash-surface/85 hover:bg-dash-surface/20"
              }`}
            >
              {s.plural}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">{children}</main>

      <UsernameDialog
        open={askUsername}
        onOpenChange={setAskUsername}
        initial={username}
        onDone={() => { void refetch(); }}
      />
    </div>
  );
};

export default CommunityShell;
