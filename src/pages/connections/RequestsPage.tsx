import { useEffect, useState } from "react";
import { Link, useSearchParams } from "@/lib/router-compat";
import { Check, Clock, ExternalLink, Globe2, Inbox, Loader2, Send, Settings2, X } from "lucide-react";

import BackButton from "@/components/common/BackButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { ROLE_LABEL, WORKSPACE_PATH, type AppRole } from "@/lib/accounts/roles";
import { useAccount } from "@/lib/accounts/useAccount";
import ConnectByCodeDialog from "@/components/connections/ConnectByCodeDialog";
import {
  relationLabel,
  requestSentence,
  type Connection,
  type ConnectionStatus,
} from "@/lib/connections/connections";
import {
  RETENTION_CHOICES,
  rejectedAgo,
  retentionLabel,
} from "@/lib/connections/rejectedRetention";
import {
  useConnectionActions,
  useConnectionCounts,
  useConnections,
  useRejectedRequests,
} from "@/lib/connections/useConnections";

type TabKey = "incoming" | "outgoing" | "accepted" | "rejected";

const TABS: { key: TabKey; label: string; status: ConnectionStatus }[] = [
  { key: "incoming", label: "Incoming", status: "pending" },
  { key: "outgoing", label: "Outgoing", status: "pending" },
  { key: "accepted", label: "Connections", status: "accepted" },
  { key: "rejected", label: "Rejected", status: "rejected" },
];

/** What each tab means when it is empty — never a generic "nothing here". */
const EMPTY_COPY: Record<TabKey, string> = {
  incoming:
    "No one is waiting for your answer. Requests sent to you — by Share Code or from the MathGPL Community — appear here.",
  outgoing:
    "You have no requests waiting for an answer. Send one with a Share Code, or find accounts in the Community of Practice.",
  accepted:
    "No connections yet. A connection appears here the moment one side accepts the other's request.",
  rejected:
    "No rejected requests. Ones that are rejected are kept here for a short while, then clear themselves.",
};

/**
 * "My Schools", "My Students", "My Teachers", "Parents" and "My Children" are
 * the same accepted connections, read through a lens. A relationship is never
 * ownership, so nothing is copied into a separate list.
 */
type ViewKey = "schools" | "teachers" | "students" | "parents" | "children";

const VIEWS: Record<ViewKey, { title: string; blurb: string; keep: (c: Connection) => boolean }> = {
  schools: {
    title: "My schools",
    blurb: "Schools you are connected to. Each school stays a separate workspace.",
    keep: (c) => c.counterpartRole === "school",
  },
  teachers: {
    title: "My teachers",
    blurb: "Teachers you are connected to.",
    keep: (c) => c.counterpartRole === "teacher",
  },
  students: {
    title: "My students",
    blurb: "Students you work with directly — separate from a school's roster.",
    keep: (c) => c.counterpartRole === "student" && c.relation !== "parent_child",
  },
  parents: {
    title: "Parents",
    blurb: "Parents you are connected to.",
    keep: (c) => c.counterpartRole === "parent",
  },
  children: {
    title: "My children",
    blurb: "Your children's accounts. Their accounts remain their own.",
    keep: (c) => c.relation === "parent_child",
  },
};

const isView = (value: string | null): value is ViewKey =>
  value !== null && Object.prototype.hasOwnProperty.call(VIEWS, value);

/** Where this account can be looked at inside Community discovery. */
const discoverHref = (role: AppRole | null, username: string | null) => {
  const category =
    role === "school" || role === "teacher" || role === "student" || role === "parent" ? role : null;
  if (!category) return null;
  return `/community/discover?category=${category}${username ? `&q=${encodeURIComponent(username)}` : ""}`;
};

const Row = ({
  connection,
  tab,
  rejectedAt,
}: {
  connection: Connection;
  tab: TabKey;
  rejectedAt?: string;
}) => {
  const { respond, responding, withdraw, withdrawing } = useConnectionActions();
  const profileHref = discoverHref(connection.counterpartRole, connection.counterpartUsername);

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
          {connection.counterpartUsername && (
            <>
              {" · "}
              <span className="font-medium text-slate-700">@{connection.counterpartUsername}</span>
            </>
          )}
        </p>
        {(tab === "incoming" || tab === "outgoing" || tab === "rejected") && (
          <p className="mt-2 text-sm text-slate-800">{requestSentence(connection)}</p>
        )}
        {tab === "incoming" && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <Clock className="h-3.5 w-3.5" /> Waiting for you
          </p>
        )}
        {tab === "outgoing" && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Clock className="h-3.5 w-3.5" /> Waiting for them to accept
          </p>
        )}
        {tab === "rejected" && rejectedAt && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Clock className="h-3.5 w-3.5" /> Answered {rejectedAgo(rejectedAt)}
          </p>
        )}
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
          {relationLabel(connection.relation)}
          {connection.orgName ? ` · ${connection.orgName}` : ""}
          {" · "}
          {new Date(connection.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {profileHref && (
          <Link
            to={profileHref}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            <ExternalLink className="mr-2 h-4 w-4" /> View profile
          </Link>
        )}
        {tab === "incoming" && (
          <>
            <Button onClick={() => void answer(true)} disabled={responding} className="min-h-[44px]">
              {responding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Accept
            </Button>
            <Button variant="outline" onClick={() => void answer(false)} disabled={responding} className="min-h-[44px]">
              <X className="mr-2 h-4 w-4" /> Decline
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
 * incoming, outgoing, live connections and rejected requests. With a `view`
 * it becomes My Schools / My Students / My Teachers / Parents / My Children.
 */
const RequestsPage = () => {
  const [params] = useSearchParams();
  const viewParam = params.get("view");
  const view = isView(viewParam) ? viewParam : null;
  const { role } = useAccount();

  const [tab, setTab] = useState<TabKey>(view ? "accepted" : "incoming");
  useEffect(() => setTab(view ? "accepted" : "incoming"), [view]);

  const { role } = useAccount();
  const dashboardPath = role ? WORKSPACE_PATH[role] : "/";
  const communityHref = discoverHref(role, null) ?? "/community/discover";

  const active = TABS.find((t) => t.key === tab)!;
  const { counts } = useConnectionCounts();
  const { data, isLoading } = useConnections(active.status);
  const rejected = useRejectedRequests();
  const lens = view ? VIEWS[view] : null;

  const rows = (data ?? []).filter((c) => {
    if (lens && !lens.keep(c)) return false;
    if (tab === "incoming") return c.direction === "incoming";
    if (tab === "outgoing") return c.direction === "outgoing";
    return true;
  });

  const rejectedRows = rejected.rows.filter((c) => !lens || lens.keep(c));
  const showing = tab === "rejected" ? rejectedRows : rows;
  const loading = tab === "rejected" ? rejected.loading : isLoading;

  const chooseRetention = async (hours: number) => {
    try {
      await rejected.retention.setHours(hours);
      toast({ title: `Rejected requests kept for ${retentionLabel(hours)}` });
    } catch (error) {
      toast({
        title: "Retention not saved",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <BackButton
            fallback={dashboardPath}
            ariaLabel="Back to Dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            <span>Back to Dashboard</span>
          </BackButton>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
                <Inbox className="h-6 w-6 text-amber-500" /> {lens ? lens.title : "Requests"}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {lens
                  ? lens.blurb
                  : "Every relationship on MathGPL is requested by one side and accepted by the other."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ConnectByCodeDialog />
              <Link
                to={communityHref}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:border-slate-400"
              >
                <Globe2 className="mr-2 h-4 w-4" /> Community of Practice
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
              {t.key === "incoming" && <Inbox className="mr-2 inline h-4 w-4" />}
              {t.key === "outgoing" && <Send className="mr-2 inline h-4 w-4" />}
              {t.label}
              {t.key === "incoming" && counts.pendingIncoming > 0 && (
                <span
                  className={`ml-2 inline-flex min-w-[20px] justify-center rounded-full px-1.5 text-xs font-semibold ${
                    tab === "incoming" ? "bg-white text-slate-900" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {counts.pendingIncoming}
                </span>
              )}
            </button>
          ))}

          {tab === "rejected" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Rejected request retention"
                  title="How long rejected requests stay visible"
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 hover:border-slate-400"
                >
                  <Settings2 className="h-4 w-4" />
                  {retentionLabel(rejected.retention.hours)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Keep rejected requests for</DropdownMenuLabel>
                {RETENTION_CHOICES.map((choice) => (
                  <DropdownMenuItem
                    key={choice.hours}
                    onSelect={() => void chooseRetention(choice.hours)}
                    className={choice.hours === rejected.retention.hours ? "font-semibold" : undefined}
                  >
                    {choice.label}
                    {choice.hours === 24 ? " (default)" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : showing.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            {EMPTY_COPY[tab]}
          </p>
        ) : (
          <ul className="space-y-3">
            {tab === "rejected"
              ? rejectedRows.map((connection) => (
                  <Row
                    key={connection.id}
                    connection={connection}
                    tab="rejected"
                    rejectedAt={connection.respondedAt}
                  />
                ))
              : rows.map((connection) => <Row key={connection.id} connection={connection} tab={tab} />)}
          </ul>
        )}

        {tab === "rejected" && rejectedRows.length > 0 && (
          <p className="text-xs text-slate-500">
            These clear themselves {retentionLabel(rejected.retention.hours).toLowerCase()} after they were
            answered. A rejected request can always be sent again.
          </p>
        )}
      </div>
    </main>
  );
};

export default RequestsPage;
