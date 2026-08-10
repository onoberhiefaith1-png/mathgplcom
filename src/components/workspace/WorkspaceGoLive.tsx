import { Radio } from "lucide-react";

import { Link } from "@/lib/router-compat";
import { Switch } from "@/components/ui/switch";
import { useGoLive } from "@/lib/connections/useConnections";

/**
 * Go Live, where it belongs: at the foot of the workspace navigation.
 *
 * It decides one thing only — whether this account can be *found* in the
 * Community. Turning it on is explained in full on the account page, so here it
 * stays a single honest switch with its current state written out.
 */
const WorkspaceGoLive = () => {
  const { live, acceptsRequests, loading, setLive, saving } = useGoLive();

  const state = loading
    ? "Checking…"
    : live
      ? acceptsRequests
        ? "Discoverable · accepting requests"
        : "Discoverable · requests off"
      : "Private · Share Code still works";

  return (
    <div className="rounded-2xl border border-ws-border/70 bg-ws-panel/70 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Radio className={`h-4 w-4 shrink-0 ${live ? "text-ws-gold" : "text-muted-foreground"}`} />
          <span className="truncate text-sm font-medium text-foreground">Go Live</span>
        </div>
        <Switch
          checked={live}
          disabled={loading || saving}
          onCheckedChange={(next) => void setLive(next)}
          aria-label="Go Live in the MathGPL Community"
          className="shrink-0"
        />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{state}</p>
      <Link to="/account" className="mt-2 inline-block text-[11px] text-ws-gold hover:underline">
        What Go Live means
      </Link>
    </div>
  );
};

export default WorkspaceGoLive;
