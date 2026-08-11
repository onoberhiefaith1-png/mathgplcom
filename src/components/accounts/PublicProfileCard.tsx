import { useState } from "react";
import { AtSign, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import AccountAvatar from "@/components/accounts/AccountAvatar";
import { ROLE_LABEL } from "@/lib/accounts/roles";
import { useAccount } from "@/lib/accounts/useAccount";
import { useProfileSummary } from "@/lib/accounts/useProfileSummary";
import { USERNAME_RULE, useUsername, usernameError, usernameIsValid } from "@/lib/accounts/useUsername";
import { useConnectionCounts, useGoLive } from "@/lib/connections/useConnections";

/**
 * Public profile.
 *
 * The registered name is the account's identity and stays read-only. The
 * username is the public handle — it is what other accounts see in the
 * Community, in a code lookup and on a connection request. The permanent
 * MathGPL ID is private and never appears here for anybody else.
 */
const PublicProfileCard = () => {
  const { role } = useAccount();
  const { displayName } = useProfileSummary();
  const { username, loading, save, saving } = useUsername();
  const { counts } = useConnectionCounts();
  const { live } = useGoLive();

  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? username ?? "";
  const dirty = draft !== null && draft.trim() !== (username ?? "");

  const commit = async () => {
    if (!usernameIsValid(value)) {
      toast({ title: "Choose a valid username", description: USERNAME_RULE, variant: "destructive" });
      return;
    }
    try {
      await save(value);
      setDraft(null);
      toast({ title: "Username saved", description: `People now see you as @${value.trim()}.` });
    } catch (error) {
      toast({
        title: "Could not save username",
        description: usernameError((error as Error).message),
        variant: "destructive",
      });
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <AtSign className="h-4 w-4 text-amber-500" /> Public profile
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        This is everything other accounts can see. Your MathGPL ID stays private — it is never shown to
        anybody else.
      </p>

      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="registered-name" className="text-slate-800">Registered name</Label>

          <Input
            id="registered-name"
            value={displayName}
            readOnly
            className="bg-slate-50 text-slate-700"
            aria-describedby="registered-name-note"
          />
          <p id="registered-name-note" className="text-xs text-slate-500">
            The name you registered with. It stays as it is.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-slate-800">Username</Label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
              <Input
                id="username"
                value={value}
                disabled={loading || saving}
                onChange={(e) => setDraft(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
                maxLength={20}
                className="bg-white pl-7 text-slate-900"
              />
            </div>
            <Button type="button" onClick={() => void commit()} disabled={!dirty || saving} className="min-h-[44px]">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save username
            </Button>
          </div>
          <p className="text-xs text-slate-500">{USERNAME_RULE} Change it whenever you like.</p>
        </div>

        {/* Exactly what another account sees. */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">How others see you</p>
          <div className="mt-3 flex items-center gap-3">
            <AccountAvatar size={44} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">@{username ?? "…"}</p>
              <p className="text-sm text-slate-600">{role ? ROLE_LABEL[role] : "Account"}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {role === "school"
                  ? `Teachers: ${counts.teachers} · Students: ${counts.students}`
                  : role === "parent"
                    ? `Children: ${counts.children}`
                    : `Connected schools: ${counts.schools} · Students: ${counts.students}`}
                {" · "}
                <span className={live ? "font-semibold text-emerald-600" : "text-slate-500"}>
                  {live ? "Live ●" : "Private"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PublicProfileCard;
