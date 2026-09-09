// Universal tutorial layer.
//
// Wraps the route outlet once, so EVERY page — present and future, including the
// intro page, the login page and the rotating building — gains a small tutorial
// icon with no per-page code.
//
// The player is an APPLICATION-LEVEL session: once a tutorial starts, moving to
// another page never destroys, reloads or rewinds it. Navigation only changes
// which page's tutorials the icon offers.

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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAccount } from "@/lib/accounts/useAccount";
import { useAssetManager } from "@/lib/gpl/useAssetManager";
import { loadTutorials, type Tutorial } from "@/lib/guides/tutorials";
import { toPageKey } from "@/lib/guides/pageKey";
import type { BoardVideoView } from "@/components/student/BoardViewSwitcher";
import TutorialPlayer from "./TutorialPlayer";
import PageGuideLauncher from "./PageGuideLauncher";
import PageGuideManagerDialog from "./PageGuideManagerDialog";

interface PageGuideContextValue {
  pageKey: string;
  /** Tutorials for the page currently on screen. */
  tutorials: Tutorial[];
  /** True when this account may add / replace / reorder / remove tutorials. */
  canManage: boolean;
  /** A tutorial session is open (possibly one started on another page). */
  open: boolean;
  view: BoardVideoView;
  setView: (next: BoardVideoView) => void;
  openGuide: () => void;
  closeGuide: () => void;
  openManager: () => void;
  /** The icon is on every page; this says whether it can be clicked. */
  hasTutorial: boolean;
  /** Always true: every page carries the control. */
  available: boolean;
}

const PageGuideContext = createContext<PageGuideContextValue | null>(null);

/** Lets any page render the tutorial control inside its own header instead of
 *  relying on the floating one. */
export const usePageGuide = () => useContext(PageGuideContext);

export const PageGuideProvider = ({ children }: { children: ReactNode }) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pageKey = useMemo(() => toPageKey(pathname), [pathname]);
  const { can, isPlatformOwner } = useAccount();
  const { isManager } = useAssetManager();
  // The database is the authority on who may manage tutorials: the administrator
  // and every account that belongs to the administrator (their own school,
  // teacher, parent and student accounts). Asking it directly means the upload
  // control appears on ALL of those accounts, and on nobody else's.
  const [dbCanManage, setDbCanManage] = useState(false);
  useEffect(() => {
    let active = true;
    const ask = async () => {
      const { data } = await supabase.rpc("can_manage_tutorials" as never);
      if (active) setDbCanManage(data === true);
    };
    void ask().catch(() => undefined);
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void ask().catch(() => undefined);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  const canManage = can("platform_admin") || isPlatformOwner || isManager || dbCanManage;


  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<BoardVideoView>("split");
  const [managerOpen, setManagerOpen] = useState(false);
  // The playing session. Kept independent of the route, so navigation never
  // stops the tutorial.
  const [session, setSession] = useState<{ tutorial: Tutorial; playlist: Tutorial[] } | null>(null);

  const refresh = useCallback(async () => {
    const list = await loadTutorials(pageKey);
    setTutorials(list);
    return list;
  }, [pageKey]);

  useEffect(() => {
    let active = true;
    setTutorials([]);
    void loadTutorials(pageKey).then((list) => {
      if (active) setTutorials(list);
    });
    return () => {
      active = false;
    };
  }, [pageKey]);

  const visible = useMemo(
    () => tutorials.filter((t) => t.status === "published" || canManage),
    [tutorials, canManage],
  );

  const openGuide = useCallback(() => {
    if (visible.length === 0) return;
    setSession({ tutorial: visible[0], playlist: visible });
    setView("split");
    setOpen(true);
  }, [visible]);

  const closeGuide = useCallback(() => setOpen(false), []);

  const value = useMemo<PageGuideContextValue>(
    () => ({
      pageKey,
      tutorials: visible,
      canManage,
      open,
      view,
      setView,
      openGuide,
      closeGuide,
      openManager: () => setManagerOpen(true),
      hasTutorial: visible.length > 0,
      available: true,
    }),
    [pageKey, visible, canManage, open, view, openGuide, closeGuide],
  );

  const showCompanion = open && Boolean(session);

  return (
    <PageGuideContext.Provider value={value}>
      {/* One constant element tree in every state: only classes change, so the
          page subtree is never remounted when the tutorial opens or closes. */}
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

        {session && (
          <div
            className={cn(
              showCompanion && view !== "board"
                ? "min-h-0 min-w-0 bg-background p-2"
                : "pointer-events-none fixed h-px w-px overflow-hidden opacity-0",
            )}
            aria-hidden={!showCompanion}
          >
            <TutorialPlayer
              tutorial={session.tutorial}
              playlist={session.playlist}
              onSelect={(tutorial) => setSession((s) => (s ? { ...s, tutorial } : s))}
              onClose={closeGuide}
            />
          </div>
        )}
      </div>

      <PageGuideLauncher />

      {canManage && (
        <PageGuideManagerDialog
          open={managerOpen}
          onOpenChange={setManagerOpen}
          pageKey={pageKey}
          tutorials={tutorials}
          onChanged={() => void refresh()}
        />
      )}
    </PageGuideContext.Provider>
  );
};

export default PageGuideProvider;
