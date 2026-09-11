// The teacher's persistent Quick Action control.
//
// Every teacher page except the Teaching Hub itself shows a small lightning
// icon. Clicking it expands the same five destinations the Teaching Hub lists,
// in a row along the bottom of the screen, so a teacher never has to travel
// back through the hub. It is a navigation layer only: it never touches the
// page underneath, so Smartboard work and its realtime link are unaffected.

import { useEffect, useRef, useState } from "react";
import { GripVertical, Lock, Zap } from "lucide-react";
import { toast } from "sonner";

import { Link, useLocation } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import { useAccount } from "@/lib/accounts/useAccount";
import { useUpgradeGuard } from "@/lib/entitlements/useUpgradeGuard";
import { useT } from "@/lib/i18n/LanguageProvider";
import { QUICK_ACTIONS, QUICK_ACTION_HOME } from "@/lib/workspace/quickActions";
import {
  DEFAULT_QUICK_PLACEMENT,
  clampQuickPlacement,
  loadQuickPlacement,
  saveQuickPlacement,
  type QuickActionPlacement,
} from "@/lib/workspace/quickActionPlacement";

const ITEM =
  "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-ws-border/70 bg-ws-panel/95 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur transition hover:border-ws-gold/60";

const QuickActionBar = () => {
  const t = useT();
  const location = useLocation();
  const { role, isPlatformOwner } = useAccount();
  const { allowed, guard, dialog } = useUpgradeGuard();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<QuickActionPlacement>(DEFAULT_QUICK_PLACEMENT);
  const dragging = useRef(false);

  useEffect(() => {
    let active = true;
    void loadQuickPlacement().then((saved) => {
      if (active && saved) setPlacement(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  // Selecting a destination closes the strip as the next page opens.
  const pathname = location.pathname;
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (role !== "teacher") return null;
  // The Teaching Hub already carries the full Quick Action section.
  if (pathname === QUICK_ACTION_HOME || pathname === `${QUICK_ACTION_HOME}/`) return null;

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!isPlatformOwner) return;
    event.preventDefault();
    dragging.current = true;
    const at = (e: PointerEvent) =>
      clampQuickPlacement({
        xPct: (e.clientX / Math.max(1, window.innerWidth)) * 100,
        yPct: (e.clientY / Math.max(1, window.innerHeight)) * 100,
      });
    const move = (e: PointerEvent) => {
      if (dragging.current) setPlacement(at(e));
    };
    const stop = (e: PointerEvent) => {
      dragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      const next = at(e);
      setPlacement(next);
      void saveQuickPlacement(next)
        .then(() => toast.success("Quick Action moved for everyone."))
        .catch(() => toast.error("Could not save that position."));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const toRight = placement.xPct <= 50;

  return (
    <>
      <div
        aria-label="Quick Action"
        className={cn(
          "pointer-events-auto fixed z-[80] flex max-w-[92vw] items-center gap-2",
          toRight ? "flex-row" : "flex-row-reverse",
          open && "flex-wrap",
        )}
        style={{
          left: `${placement.xPct}%`,
          top: `${placement.yPct}%`,
          transform: `translate(${toRight ? "0" : "-100%"}, -50%)`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {isPlatformOwner && (
          <button
            type="button"
            onPointerDown={startDrag}
            title="Drag to move Quick Action — the new spot is saved for everyone"
            aria-label="Move the Quick Action button"
            className="inline-flex h-10 w-6 cursor-grab touch-none items-center justify-center rounded-full border border-ws-border/70 bg-ws-panel/95 text-muted-foreground shadow-lg active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Hide Quick Action" : "Quick Action"}
          title="Quick Action"
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-lg ring-2 ring-background/60 transition",
            open
              ? "border-ws-gold/60 bg-ws-gold/20 text-ws-gold"
              : "border-ws-border/70 bg-ws-panel/95 text-ws-gold hover:border-ws-gold/60",
          )}
        >
          <Zap className="h-5 w-5" />
        </button>

        {open &&
          QUICK_ACTIONS.map((item) =>
            !item.feature || allowed(item.feature) ? (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={ITEM}>
                <item.icon className="h-4 w-4 shrink-0 text-ws-gold" />
                <span className="whitespace-nowrap">{t(item.labelKey)}</span>
              </Link>
            ) : (
              <button
                key={item.to}
                type="button"
                onClick={() => guard(item.feature!, () => {})}
                className={cn(ITEM, "text-muted-foreground")}
              >
                <Lock className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{t(item.labelKey)}</span>
              </button>
            ),
          )}
      </div>
      {dialog}
    </>
  );
};

export default QuickActionBar;
