import { useState, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { useEntitlements } from "./useEntitlements";
import { limitMessage, upgradeMessage, type FeatureKey, type LimitKey } from "./features";

/**
 * Guards an action rather than a whole page: a blocked click raises the upgrade
 * dialog instead of silently doing nothing. The server still refuses the same
 * action independently — this only makes the refusal understandable.
 */
export function useUpgradeGuard() {
  const { has, limit, labelOf } = useEntitlements();
  const [blocked, setBlocked] = useState<string | null>(null);

  /** Runs `action` when the entitlement is held; otherwise explains why not. */
  const guard = (feature: FeatureKey, action: () => void | Promise<void>) => {
    if (!has(feature)) {
      setBlocked(upgradeMessage(feature, labelOf(feature)));
      return;
    }
    void action();
  };

  /** Same, for a numeric plan cap such as classes or students. */
  const guardLimit = (key: LimitKey, current: number, action: () => void | Promise<void>) => {
    const cap = limit(key);
    if (cap !== null && current >= cap) {
      setBlocked(limitMessage(key, cap));
      return;
    }
    void action();
  };

  const allowed = (feature: FeatureKey) => has(feature);
  const explain = (message: string) => setBlocked(message);

  const dialog: ReactNode = (
    <Dialog open={blocked !== null} onOpenChange={(open) => !open && setBlocked(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Available on a higher plan</DialogTitle>
          <DialogDescription>{blocked}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setBlocked(null)} className="min-h-11">
            Not now
          </Button>
          <Button asChild className="min-h-11 rounded-full px-6">
            <Link to="/plans/gateway?change=1">Upgrade to Pro</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { guard, guardLimit, allowed, explain, dialog };
}
