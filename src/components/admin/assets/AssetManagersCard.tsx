import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAssetManagers,
  grantAssetManager,
  revokeAssetManager,
  type AssetManagerRow,
} from "@/lib/gpl/assetManagers.functions";

/**
 * The permanent Asset Library manager list. Owner and co-admin always manage
 * the library; everyone on this list does too, for as long as they are on it.
 */
const AssetManagersCard = () => {
  const load = useServerFn(fetchAssetManagers);
  const grant = useServerFn(grantAssetManager);
  const revoke = useServerFn(revokeAssetManager);
  const { toast } = useToast();

  const [rows, setRows] = useState<AssetManagerRow[]>([]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(true);

  const run = async (task: () => Promise<{ rows: AssetManagerRow[] }>) => {
    setBusy(true);
    try {
      setRows((await task()).rows);
      return true;
    } catch (error) {
      toast({
        title: "Could not update asset managers",
        description: (error as Error).message,
        variant: "destructive",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void run(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mb-6 rounded-3xl border border-dash-surface/15 bg-dash-surface/5 p-6 backdrop-blur">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-gold">
        Permanent asset managers
      </h3>
      <p className="mt-2 text-sm text-dash-surface/70">
        You always manage the library. Add an account here to give it the same add, edit and delete
        power on the Assets pages — no code to redeem, nothing to expire.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface/70">
            Account email
          </label>
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="manager@example.com"
            className="mt-1 min-h-[44px] bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface/70">
            Note (optional)
          </label>
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. library manager"
            className="mt-1 min-h-[44px] bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <Button
          className="min-h-[44px] gap-2"
          disabled={busy || !email.trim()}
          onClick={() => {
            void run(() => grant({ data: { email: email.trim(), note: note.trim() || undefined } })).then(
              (ok) => {
                if (ok) {
                  setEmail("");
                  setNote("");
                }
              },
            );
          }}
        >
          <UserPlus className="h-4 w-4" /> Add manager
        </Button>
      </div>

      <div className="mt-5 space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dash-surface/10 bg-dash-surface/5 px-4 py-3"
          >
            <div className="text-sm text-dash-surface">
              <div className="font-semibold">{row.name ?? row.email ?? row.userId}</div>
              <div className="text-xs text-dash-surface/60">
                {row.email ?? "email unavailable"}
                {row.note ? ` · ${row.note}` : ""}
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => void run(() => revoke({ data: { id: row.id } }))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {!rows.length && !busy && (
          <p className="py-4 text-center text-sm text-dash-surface/60">
            No extra managers yet — only you can edit the library.
          </p>
        )}
        {busy && (
          <div className="flex justify-center py-4 text-dash-surface/60">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetManagersCard;
