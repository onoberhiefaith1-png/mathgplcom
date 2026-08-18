import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  createAccessCode,
  deleteAccessCode,
  fetchAccessCodes,
  setAccessCodeActive,
  type AccessCodeRow,
  type CodePurpose,
} from "@/lib/access/accessCodes.functions";

/**
 * Access codes for the secret entrance. Each code belongs to one person: once
 * someone signs in with it, it is locked to that account and refuses everyone
 * else. Codes never carry administrative rights.
 */
const AccessCodesPage = () => {
  const load = useServerFn(fetchAccessCodes);
  const create = useServerFn(createAccessCode);
  const toggle = useServerFn(setAccessCodeActive);
  const remove = useServerFn(deleteAccessCode);
  const { toast } = useToast();

  const [purpose, setPurpose] = useState<CodePurpose>("access");
  const [rows, setRows] = useState<AccessCodeRow[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(true);

  const run = async (task: () => Promise<{ rows: AccessCodeRow[] }>) => {
    setBusy(true);
    try {
      setRows((await task()).rows);
    } catch (error) {
      toast({ title: "Could not update access codes", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void run(() => load({ data: { purpose } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purpose]);

  return (
    <DashboardShell title="Access codes" subtitle="Give selected people full access without a subscription. One code, one person.">
      <div className="mb-5 flex flex-wrap gap-2">
        {([
          { value: "access" as CodePurpose, label: "Full access" },
          { value: "asset_manager" as CodePurpose, label: "Asset manager" },
        ]).map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setPurpose(tab.value)}
            className={`min-h-[44px] rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.14em] transition ${
              purpose === tab.value
                ? "border-dash-gold/60 bg-dash-gold/15 text-dash-gold"
                : "border-dash-surface/25 bg-dash-surface/10 text-dash-surface/80 hover:bg-dash-surface/20"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-sm text-dash-surface/70">
        {purpose === "access"
          ? "Full-access codes unlock the paid features of the person's own account. They carry no administrative rights."
          : "Asset-manager codes let the holder add and edit the official asset library on the Assets pages. They see nothing else of the console."}
      </p>

      <div className="rounded-3xl border border-dash-surface/15 bg-dash-surface/5 p-6 backdrop-blur">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface/70">Who is this for?</label>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Mrs Okoro — pilot teacher"
              className="mt-1 min-h-[44px] bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <Button
            onClick={() => {
              void run(() => create({ data: { label, purpose } })).then(() => setLabel(""));
            }}
            disabled={busy}
            className="min-h-[44px] gap-2"
          >
            <Plus className="h-4 w-4" /> Generate code
          </Button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm text-dash-surface">
            <thead className="text-xs uppercase tracking-[0.14em] text-dash-surface/60">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">For</th>
                <th className="px-3 py-2 text-left">Holder</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-dash-surface/10">
                  <td className="px-3 py-3 font-mono">{row.code}</td>
                  <td className="px-3 py-3 text-dash-surface/80">{row.label ?? "—"}</td>
                  <td className="px-3 py-3 text-dash-surface/80">
                    {row.claimedBy ? `${row.holderName ?? "Claimed"}${row.holderId ? ` · ${row.holderId}` : ""}` : "Unclaimed"}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        row.active ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"
                      }`}
                    >
                      {row.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void run(() => toggle({ data: { id: row.id, active: !row.active, purpose } }))}
                      >
                        {row.active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={() => void run(() => remove({ data: { id: row.id, purpose } }))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && !busy && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-dash-surface/60">
                    No codes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {busy && (
            <div className="flex justify-center py-6 text-dash-surface/60">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
};

export default AccessCodesPage;
