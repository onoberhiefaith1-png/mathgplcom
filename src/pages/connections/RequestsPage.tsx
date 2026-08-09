import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Check, Inbox, Loader2, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ROLE_LABEL } from "@/lib/accounts/roles";
import ConnectByCodeDialog from "@/components/connections/ConnectByCodeDialog";
import { relationLabel, type Connection, type ConnectionStatus } from "@/lib/connections/connections";
import { useConnectionActions, useConnections } from "@/lib/connections/useConnections";

type TabKey = "incoming" | "outgoing" | "accepted" | "rejected";

const TABS: { key: TabKey; label: string; status: ConnectionStatus }[] = [
  { key: "incoming", label: "Incoming", status: "pending" },
  { key: "outgoing", label: "Outgoing", status: "pending" },
  { key: "accepted", label: "Connections", status: "accepted" },
  { key: "rejected", label: "Rejected", status: "rejected" },
];

const Row = ({
  connection,
  tab,
}: {
  connection: Connection;
  tab: TabKey;
}) => {
  const { respond, responding, withdraw, withdrawing } = useConnectionActions();

  const answer = async (accept: boolean) => {
    try {
      await respond({ id: connection.id, accept });
      toast({ title: accept ? "Connection accepted" : "Request rejected" });
    } catch (error) {
      toast({ title: "Could not respond", description: (error as Error).message, variant: "destructive" });
    }
  };

  const drop = async () => {
    try {
      await withdraw(connection.id);
      toast({ title: tab === "outgoing" ? "Request withdrawn" : "Connection ended" });
    } catch (error) {
      toast({ title: "Could not update", description: (error as Error).message, variant: "destructive" });
    }
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">{connection.counterpartName}</p>
        <p className="mt-0.5 text-sm text-slate-600">
          {connection.counterpartRole ? ROLE_LABEL[connection.counterpartRole] : "Account"}
          {connection.counterpartMathgplId && (
            <>
              {" · "}
              <span className="font-mono">{connection.counterpartMathgplId}</span>
            </>
          )}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
          {relationLabel(connection.relation)}
          {connection.orgName ? ` · ${connection.orgName}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tab === "incoming" && (
          <>
            <Button onClick={() => void answer(true)} disabled={responding} className="min-h-[44px]">
              {responding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Accept
            </Button>
            <Button variant="outline" onClick={() => void answer(false)} disabled={responding} className="min-h-[44px]">
              <X className="mr-2 h-4 w-4" /> Reject
            </Button>
          </>
        )}
        {(tab === "outgoing" || tab === "accepted") && (
          <Button variant="outline" onClick={() => void drop()} disabled={withdrawing} className="min-h-[44px]">
            {withdrawing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
            {tab === "outgoing" ? "Withdraw" : "Disconnect"}
          </Button>
        )}
      </div>
    </li>
  );
};

/**
 * Requests — the single place every account answers and tracks relationships:
 * incoming, outgoing, live connections and rejected requests.
 */
const RequestsPage = () => {
  const [tab, setTab] = useState<TabKey>("incoming");
  const active = TABS.find((t) => t.key === tab)!;
  const { data, isLoading } = useConnections(active.status);

  const rows = (data ?? []).filter((c) => {
    if (tab === "incoming") return c.direction === "incoming";
    if (tab === "outgoing") return c.direction === "outgoing";
    return true;
  });

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            <ArrowLeft className="mr-1 inline h-4 w-4" /> Back to my building
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
                <Inbox className="h-6 w-6 text-amber-500" /> Requests
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Every relationship on MathGPL is requested by one side and accepted by the other.
              </p>
            </div>
            <ConnectByCodeDialog />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`min-h-[40px] rounded-full border px-4 text-sm font-medium transition ${
                tab === t.key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {t.label === "Incoming" && <Inbox className="mr-2 inline h-4 w-4" />}
              {t.label === "Outgoing" && <Send className="mr-2 inline h-4 w-4" />}
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Nothing here yet. Connect using a Share Code, or find schools, teachers and students in
            the MathGPL Community.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((connection) => (
              <Row key={connection.id} connection={connection} tab={tab} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
};

export default RequestsPage;
