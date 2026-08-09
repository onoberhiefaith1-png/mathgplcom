import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Building2, GraduationCap, Loader2, Search, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ROLE_LABEL } from "@/lib/accounts/roles";
import { useAccount } from "@/lib/accounts/useAccount";
import ConnectByCodeDialog from "@/components/connections/ConnectByCodeDialog";
import { relationFor, type DiscoveredAccount } from "@/lib/connections/connections";
import { useConnectionActions, useDiscover } from "@/lib/connections/useConnections";

type Category = "school" | "teacher" | "student";

const CATEGORIES: { key: Category; label: string; Icon: typeof Users; blurb: string }[] = [
  { key: "school", label: "Schools", Icon: Building2, blurb: "Schools open to new teachers and students." },
  { key: "teacher", label: "Teachers", Icon: GraduationCap, blurb: "Teachers who are live right now." },
  { key: "student", label: "Students", Icon: Users, blurb: "Students who chose to be discoverable." },
];

const Card = ({ account }: { account: DiscoveredAccount }) => {
  const { role } = useAccount();
  const { send, sending } = useConnectionActions();
  const relation = relationFor(role, account.role ?? null);

  const connect = async () => {
    if (!relation) return;
    try {
      await send({ userId: account.userId, relation });
      toast({ title: "Request sent", description: `${account.displayName} decides whether to accept.` });
    } catch (error) {
      toast({ title: "Could not send request", description: (error as Error).message, variant: "destructive" });
    }
  };

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="truncate text-base font-semibold text-slate-900">{account.displayName}</p>
      <p className="mt-0.5 text-sm text-slate-600">
        {account.role ? ROLE_LABEL[account.role] : "Account"}
        {account.mathgplId && (
          <>
            {" · "}
            <span className="font-mono">{account.mathgplId}</span>
          </>
        )}
      </p>

      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
        {account.role === "school"
          ? `${account.teachers ?? 0} teachers · ${account.students ?? 0} students`
          : `Activity ${account.activity}`}
      </p>

      <div className="mt-4">
        {account.connectionStatus === "accepted" ? (
          <span className="text-sm font-medium text-emerald-600">Connected</span>
        ) : account.connectionStatus === "pending" ? (
          <span className="text-sm font-medium text-amber-600">Request pending</span>
        ) : relation ? (
          <Button type="button" onClick={connect} disabled={sending} className="min-h-[44px] w-full">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {account.role === "school" ? "Request to join" : "Request to connect"}
          </Button>
        ) : (
          <span className="text-sm text-slate-500">No direct connection between these account types.</span>
        )}
      </div>
    </li>
  );
};

/**
 * Community of Practice — discovery.
 *
 * Schools, Teachers and Students, ranked by real activity rather than
 * alphabetically, and always searchable. Teachers and students only appear
 * while they are live; nothing private is ever shown.
 */
const CommunityDiscoverPage = () => {
  const [category, setCategory] = useState<Category>("school");
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const { data, isLoading } = useDiscover(category, query);
  const active = CATEGORIES.find((c) => c.key === category)!;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <Link to="/community" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            <ArrowLeft className="mr-1 inline h-4 w-4" /> MathGPL Community
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Community of Practice</h1>
              <p className="mt-1 text-sm text-slate-600">{active.blurb}</p>
            </div>
            <ConnectByCodeDialog />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`min-h-[44px] rounded-full border px-5 text-sm font-semibold transition ${
                category === key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <Icon className="mr-2 inline h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(term.trim());
          }}
        >
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={`Search ${active.label.toLowerCase()} by name or MathGPL ID`}
            className="max-w-sm bg-white text-slate-900 placeholder:text-slate-400"
            maxLength={60}
          />
          <Button type="submit" variant="outline" className="min-h-[44px]">
            <Search className="mr-2 h-4 w-4" /> Search
          </Button>
        </form>

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Nothing to show yet. {category === "school"
              ? "Schools appear here once their workspace is public."
              : "Accounts appear here once they turn Go Live on."}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(data ?? []).map((account) => (
              <Card key={account.userId} account={account} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
};

export default CommunityDiscoverPage;
