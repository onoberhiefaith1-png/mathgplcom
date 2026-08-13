import { Lock, Sparkles } from "lucide-react";
import { Link } from "@/lib/router-compat";

import { Button } from "@/components/ui/button";

/**
 * The one place a customer is told a feature is not part of their plan. Calm,
 * professional, and always with a way forward.
 */
const UpgradeNotice = ({
  title = "Available on a higher plan",
  message,
  compact = false,
}: {
  title?: string;
  message: string;
  compact?: boolean;
}) => (
  <div
    className={`mx-auto w-full max-w-xl rounded-2xl border border-amber-300/30 bg-card/70 text-center shadow-lg backdrop-blur ${
      compact ? "p-5" : "p-8"
    }`}
  >
    <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/15 text-amber-300">
      <Lock className="h-5 w-5" />
    </span>
    <h2 className={`font-semibold ${compact ? "text-base" : "text-xl"}`}>{title}</h2>
    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
    <Button asChild className="mt-5 min-h-11 rounded-full px-6">
      <Link to="/plans/gateway">
        <Sparkles className="mr-2 h-4 w-4" />
        Upgrade to Pro
      </Link>
    </Button>
  </div>
);

export default UpgradeNotice;
