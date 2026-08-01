import { Link } from "@/lib/router-compat";
import { ArrowLeft, Home } from "lucide-react";
import WorkspaceCard, { type WorkspaceTile } from "@/components/workspace/WorkspaceCard";
import { useCommunityIdentity } from "@/lib/community/useCommunity";

/**
 * A community hub page. The rotating building never shows content: it routes
 * here, and this page routes on to the dedicated read-only libraries.
 */
const CommunityHubPage = ({
  title,
  subtitle,
  tiles,
  workspacePath,
  backTo = "/community",
  backLabel = "MathGPL Community",
}: {
  title: string;
  subtitle: string;
  tiles: WorkspaceTile[];
  /** The private-workspace twin of this hub. */
  workspacePath: string;
  backTo?: string;
  backLabel?: string;
}) => {
  const { username } = useCommunityIdentity();

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(160deg,hsl(222_47%_11%),hsl(222_44%_16%))] text-dash-surface">
      <header className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={backTo}
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-dash-surface/70 transition hover:text-dash-surface"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-dash-surface/70">{subtitle}</p>
            {username && <p className="mt-1 text-xs text-dash-surface/50">Signed in as @{username}</p>}
          </div>

          <Link
            to={workspacePath}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-dash-gold/40 bg-dash-navy/40 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-gold backdrop-blur transition hover:bg-dash-navy/60"
          >
            <Home className="h-3.5 w-3.5" /> My workspace
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-4 pb-24 pt-8 sm:grid-cols-2 sm:px-6">
        {tiles.map((tile) => (
          <WorkspaceCard key={tile.label} tile={tile} />
        ))}
      </main>
    </div>
  );
};

export default CommunityHubPage;
