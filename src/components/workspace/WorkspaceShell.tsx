import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Maximize, Minimize, Settings as SettingsIcon } from "lucide-react";
import WorkspaceCard, { type WorkspaceTile } from "./WorkspaceCard";
import WorkspaceSwitcher from "@/components/accounts/WorkspaceSwitcher";

export type WorkspaceId = "teaching-hub" | "live" | "community";

const TABS: { id: WorkspaceId; label: string; to: string }[] = [
  { id: "teaching-hub", label: "Teaching Hub", to: "/teaching-hub" },
  { id: "live", label: "MathGPL Live", to: "/live" },
  { id: "community", label: "MathGPL Community", to: "/community" },
];


const SETTINGS_PATH = "/teaching-hub/settings";

const useFullscreen = () => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  return { active, toggle };
};

/**
 * The shared shell for the two workspaces: identical header, tabs, icon
 * actions, spacing and grid. Only the tile list differs per workspace.
 */
const WorkspaceShell = ({
  active,
  tiles,
  children,
}: {
  active: WorkspaceId;
  tiles: WorkspaceTile[];
  children?: ReactNode;
}) => {
  const fullscreen = useFullscreen();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-5">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          aria-label="Home"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <nav className="inline-flex rounded-full border border-border bg-card/50 p-1 backdrop-blur">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              to={tab.to}
              aria-current={tab.id === active ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab.id === active
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <WorkspaceSwitcher compact />
          <Link
            to={SETTINGS_PATH}
            aria-label="Settings"
            title="Settings"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <SettingsIcon className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={fullscreen.toggle}
            aria-label={fullscreen.active ? "Exit full screen" : "Full screen"}
            title={fullscreen.active ? "Exit full screen" : "Full screen"}
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            {fullscreen.active ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main key={active} className="mx-auto max-w-5xl animate-in fade-in slide-in-from-bottom-2 px-6 py-8 duration-300">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {tiles.map((tile) => (
            <WorkspaceCard key={tile.label} tile={tile} />
          ))}
        </div>
        {children}
      </main>
    </div>
  );
};

export default WorkspaceShell;
