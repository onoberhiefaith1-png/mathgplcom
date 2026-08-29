// Universal Page Guide layer.
//
// Wraps the route outlet once, so EVERY page — present and future — gains a
// small guide control with no per-page code. Opening the guide never remounts
// the page: the same outlet element stays in place and simply shares the screen
// with the companion panel, so forms, editors and boards keep their state.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useAccount } from "@/lib/accounts/useAccount";
import { loadPageGuide, type PageGuide } from "@/lib/guides/pageGuides";
import { toPageKey } from "@/lib/guides/pageKey";
import type { BoardVideoView } from "@/components/student/BoardViewSwitcher";
import PageGuidePlayer from "./PageGuidePlayer";
import PageGuideLauncher from "./PageGuideLauncher";
import PageGuideManagerDialog from "./PageGuideManagerDialog";

interface PageGuideContextValue {
  pageKey: string;
  guide: PageGuide | null;
  /** True when this account may upload / replace / publish guides. */
  canManage: boolean;
  open: boolean;
  view: BoardVideoView;
  setView: (next: BoardVideoView) => void;
  openGuide: () => void;
  closeGuide: () => void;
  openManager: () => void;
  /** True when the launcher should be visible at all. */
  available: boolean;
}

const PageGuideContext = createContext<PageGuideContextValue | null>(null);

/** Lets any page render the guide control inside its own header instead of
 *  relying on the floating launcher. */
export const usePageGuide = () => useContext(PageGuideContext);

const HIDDEN_PREFIXES = ["/auth", "/login", "/signup", "/api", "/lovable"];

export const PageGuideProvider = ({ children }: { children: ReactNode }) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pageKey = useMemo(() => toPageKey(pathname), [pathname]);
  const { can, isPlatformOwner } = useAccount();
  const canManage = can("platform_admin") || isPlatformOwner;

  const [guide, setGuide] = useState<PageGuide | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<BoardVideoView>("split");
  const [managerOpen, setManagerOpen] = useState(false);
  // Mounted from the first open onwards, so the playhead survives closing.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let active = true;
    setOpen(false);
    setGuide(null);
    void loadPageGuide(pageKey).then((found) => {
      if (active) setGuide(found);
    });
    return () => {
      active = false;
    };
  }, [pageKey]);

  const openGuide = useCallback(() => {
    setMounted(true);
    setView("split");
    setOpen(true);
  }, []);
  const closeGuide = useCallback(() => setOpen(false), []);

  const visibleGuide = guide && (guide.status === "published" || canManage) ? guide : null;
  const hidden = HIDDEN_PREFIXES.some((p) => pageKey === p || pageKey.startsWith(`${p}/`));
  const available = !hidden && (Boolean(visibleGuide?.videoPath) || canManage);

  const value = useMemo<PageGuideContextValue>(
    () => ({
      pageKey,
      guide: visibleGuide,
      canManage,
      open,
      view,
      setView,
      openGuide,
      closeGuide,
      openManager: () => setManagerOpen(true),
      available,
    }),
    [pageKey, visibleGuide, canManage, open, view, openGuide, closeGuide, available],
  );

  const showCompanion = open && Boolean(visibleGuide?.videoPath);

  return (
    <PageGuideContext.Provider value={value}>
      {/* One constant element tree in every state: only classes change, so the
          page subtree is never remounted when the guide opens or closes. */}
      <div
        data-page-guide-root=""
        className={cn(
          showCompanion &&
            "grid h-screen min-h-0 grid-cols-1 grid-rows-[minmax(0,1.1fr)_minmax(0,1fr)] gap-px overflow-hidden bg-border lg:grid-cols-[1.5fr_1fr] lg:grid-rows-1",
          showCompanion && view === "video" && "grid-rows-1 lg:grid-cols-1",
        )}
      >
        <div
          className={cn(
            showCompanion && "relative min-h-0 min-w-0 overflow-auto bg-background",
            showCompanion && view === "video" && "hidden",
          )}
        >
          {children}
        </div>

        {mounted && (
          <div
            className={cn(
              showCompanion && view !== "board"
                ? "min-h-0 min-w-0 bg-background p-2"
                : "pointer-events-none fixed h-px w-px overflow-hidden opacity-0",
            )}
            aria-hidden={!showCompanion}
          >
            {visibleGuide && <PageGuidePlayer guide={visibleGuide} onClose={closeGuide} />}
          </div>
        )}
      </div>

      {available && <PageGuideLauncher />}

      {canManage && (
        <PageGuideManagerDialog
          open={managerOpen}
          onOpenChange={setManagerOpen}
          pageKey={pageKey}
          guide={guide}
          onSaved={setGuide}
        />
      )}
    </PageGuideContext.Provider>
  );
};

export default PageGuideProvider;
