import { useEffect, useRef, useState } from "react";
import { ShieldAlert, LogOut, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { activeImpersonation, endImpersonation, type ImpersonationInfo } from "@/lib/accounts/impersonation";
import { useDraggableTab } from "@/hooks/useDraggableTab";

const FOLDED_KEY = "mgpl:impersonation-banner-folded";

/**
 * Shown platform-wide while a platform administrator is inside another
 * account's workspace. Exit restores the administrator's own session.
 *
 * The banner can be folded into a small top tab so the page below reclaims
 * the vertical space. The folded state persists for the current workspace
 * session only (sessionStorage).
 */
const ImpersonationBanner = () => {
  const [info, setInfo] = useState<ImpersonationInfo | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [folded, setFolded] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const drag = useDraggableTab("mgpl:impersonation-tab-x");

  useEffect(() => {
    setInfo(activeImpersonation());
    try {
      setFolded(sessionStorage.getItem(FOLDED_KEY) === "1");
    } catch {
      // sessionStorage may be unavailable in some environments.
    }
    const onStorage = () => setInfo(activeImpersonation());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);


  useEffect(() => {
    try {
      sessionStorage.setItem(FOLDED_KEY, folded ? "1" : "0");
    } catch {
      // ignore
    }
  }, [folded]);

  // Push page content down by the banner's exact height when expanded so that
  // collapsing the banner genuinely reclaims vertical space.
  useEffect(() => {
    if (!info || folded) {
      document.body.style.paddingTop = "0px";
      return;
    }

    const banner = bannerRef.current;
    if (!banner) return;

    const applyPadding = () => {
      document.body.style.paddingTop = `${banner.offsetHeight}px`;
    };

    applyPadding();

    const observer = new ResizeObserver(applyPadding);
    observer.observe(banner);
    window.addEventListener("resize", applyPadding);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", applyPadding);
      document.body.style.paddingTop = "0px";
    };
  }, [info, folded]);

  if (!info) return null;

  const exit = async () => {
    setLeaving(true);
    try {
      await endImpersonation();
      window.location.assign("/admin");
    } finally {
      setLeaving(false);
    }
  };

  if (folded) {
    return (
      <button
        type="button"
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.endDrag}
        onPointerCancel={drag.endDrag}
        onClick={() => {
          if (drag.wasDragged()) return;
          setFolded(false);
        }}
        title="Show workspace bar — drag left or right to move it"
        style={{ transform: `translateX(${drag.offsetX}px)` }}
        className={`fixed inset-x-0 top-0 z-[100] mx-auto w-fit touch-none rounded-b-full border-x border-b border-primary/40 bg-primary px-4 py-1 text-[10px] font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 ${drag.dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <span className="inline-flex items-center gap-1">
          <ChevronDown className="h-3 w-3" />
          Workspace
        </span>
      </button>
    );
  }


  return (
    <div
      ref={bannerRef}
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg"
    >
      <ShieldAlert className="h-4 w-4" />
      <span className="truncate">
        Viewing {info.name} as {info.role.replace(/_/g, " ")}
      </span>
      <button
        type="button"
        onClick={() => setFolded(true)}
        title="Hide workspace bar"
        className="inline-flex items-center rounded-full bg-primary-foreground/15 p-1 transition hover:bg-primary-foreground/25"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={exit}
        disabled={leaving}
        className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-3 py-1 transition hover:bg-primary-foreground/25 disabled:opacity-60"
      >
        {leaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        Exit workspace
      </button>
    </div>
  );
};

export default ImpersonationBanner;
