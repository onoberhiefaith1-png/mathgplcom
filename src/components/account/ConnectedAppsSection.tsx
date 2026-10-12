import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Grant = { client: { id: string; name: string }; granted_at: string };
type OAuthGrantsApi = {
  listGrants: () => Promise<{ data: Grant[] | null; error: { message: string } | null }>;
  revokeGrant: (o: { clientId: string }) => Promise<{ error: { message: string } | null }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthGrantsApi }).oauth;

/**
 * Apps (such as ChatGPT) the teacher has approved to act on their account.
 * Disconnecting revokes that app's sessions and renewal tokens immediately.
 */
export default function ConnectedAppsSection() {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await oauth().listGrants();
    if (error) {
      setGrants([]);
      return;
    }
    setGrants(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = async (g: Grant) => {
    setBusy(g.client.id);
    const { error } = await oauth().revokeGrant({ clientId: g.client.id });
    setBusy(null);
    if (error) {
      toast.error("Could not disconnect", { description: "Please try again." });
      return;
    }
    toast.success(`${g.client.name || "App"} disconnected`);
    await load();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <Link2 className="h-4 w-4 text-slate-500" /> Connected apps
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Apps you approved, such as ChatGPT, stay connected when you sign out of this website.
        Disconnect an app to stop its access straight away.
      </p>
      <div className="mt-4 space-y-2">
        {grants === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : grants.length === 0 ? (
          <p className="text-sm text-slate-500">No connected apps.</p>
        ) : (
          grants.map((g) => (
            <div key={g.client.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{g.client.name || "Connected app"}</div>
                <div className="text-xs text-slate-500">Connected {new Date(g.granted_at).toLocaleDateString()}</div>
              </div>
              <button
                type="button"
                onClick={() => disconnect(g)}
                disabled={busy === g.client.id}
                className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                {busy === g.client.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
