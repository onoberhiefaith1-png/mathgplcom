import { Loader2, Radio } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useGoLive } from "@/lib/connections/useConnections";

/**
 * Go Live.
 *
 * Live decides one thing only: whether this account can be *found* in the
 * Community of Practice. It never exposes an email address, a password or any
 * private account information, and private connection by Share Code keeps
 * working whether Live is on or off.
 */
export const GoLiveToggle = ({ blurb }: { blurb?: string }) => {
  const { live, loading, setLive, saving } = useGoLive();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Radio className={`h-4 w-4 ${live ? "text-emerald-500" : "text-slate-400"}`} /> Go Live
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            {blurb ??
              "While you are live, other MathGPL accounts can discover you in the Community of Practice and send you a connection request. Turn it off and you disappear from discovery."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(loading || saving) && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          <Switch
            checked={live}
            disabled={loading || saving}
            onCheckedChange={(value) => void setLive(Boolean(value))}
            aria-label="Go live in the MathGPL Community"
          />
          <span className="text-sm font-medium text-slate-700">{live ? "Live" : "Off"}</span>
        </div>
      </div>
    </section>
  );
};

export default GoLiveToggle;
