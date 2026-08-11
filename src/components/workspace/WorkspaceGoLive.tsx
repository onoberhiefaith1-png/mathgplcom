import { useState } from "react";
import { Radio } from "lucide-react";

import { Link } from "@/lib/router-compat";
import GoLiveExplainDialog from "@/components/connections/GoLiveExplainDialog";
import { useGoLive } from "@/lib/connections/useConnections";

/**
 * Go Live, where it belongs: at the foot of the workspace navigation.
 *
 * It decides one thing only — whether this account can be *found* in the
 * Community. The whole card is the control: turning it on always explains
 * itself first, turning it off is a single click. The state shown here is the
 * same state the account page reads, so the two can never disagree.
 */
const WorkspaceGoLive = () => {
  const { live, acceptsRequests, loading, setLive, saving } = useGoLive();
  const [explaining, setExplaining] = useState(false);

  const state = loading
    ? "Checking…"
    : live
      ? acceptsRequests
        ? "Discoverable · accepting requests"
        : "Discoverable · requests off"
      : "Private · Share Code still works";

  const toggle = () => {
    if (loading || saving) return;
    if (live) {
      void setLive(false);
      return;
    }
    setExplaining(true);
  };

  return (
    <div className="rounded-2xl border border-ws-border/70 bg-ws-panel/70 p-3">
      <button
        type="button"
        onClick={toggle}
        disabled={loading || saving}
        aria-pressed={live}
        aria-label="Go Live in the MathGPL Community"
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl text-left transition hover:opacity-90"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Radio className={`h-4 w-4 shrink-0 ${live ? "text-ws-gold" : "text-muted-foreground"}`} />
          <span className="truncate text-sm font-medium text-foreground">Go Live</span>
        </span>
        {/* Presentational track: the whole card is the button. */}
        <span
          aria-hidden
          className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
            live ? "border-ws-gold bg-ws-gold/80" : "border-ws-border bg-ws-panel"
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-background shadow transition ${live ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </span>

      </button>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{state}</p>
      <Link to="/account" className="mt-2 inline-block text-[11px] text-ws-gold hover:underline">
        What Go Live means
      </Link>

      <GoLiveExplainDialog open={explaining} onOpenChange={setExplaining} />
    </div>
  );
};

export default WorkspaceGoLive;
