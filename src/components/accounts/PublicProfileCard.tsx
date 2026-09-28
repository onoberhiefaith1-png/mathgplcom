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
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConnectionCounts, useGoLive } from "@/lib/connections/useConnections";

/**
 * Public profile.
 *
 * The registered name (school name for schools) is editable here. The
 * username is the public handle — it is what other accounts see in the
 * Community, in a code lookup and on a connection request. The permanent
 * MathGPL ID is private and never appears here for anybody else.
 */
const PublicProfileCard = () => {
  const { role, userId, orgId } = useAccount();
  const { displayName } = useProfileSummary();
  const { username, loading, save, saving } = useUsername();
  const { counts } = useConnectionCounts();
  const { live } = useGoLive();

  const qc = useQueryClient();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const nameValue = nameDraft ?? displayName ?? "";
  const nameDirty = nameDraft !== null && nameDraft.trim() !== (displayName ?? "") && nameDraft.trim().length >= 2;

  // The registered name. For a school account it is also the school's name,
  // so the Academia and every listing follow it.
  const commitName = async () => {
    if (!userId) return;
    setNameSaving(true);
    try {
      const next = nameValue.trim().slice(0, 80);
      const { error } = await supabase.from("profiles").update({ display_name: next }).eq("user_id", userId);
      if (error) throw error;
      if (role === "school" && orgId) {
        const { error: e2 } = await supabase.from("organizations").update({ name: next }).eq("id", orgId);
        if (e2) throw e2;
      }
      setNameDraft(null);
      await qc.invalidateQueries();
      toast({ title: role === "school" ? "School name saved" : "Name saved" });
    } catch (error) {
      toast({ title: "Could not save the name", description: (error as Error).message, variant: "destructive" });
    } finally {
      setNameSaving(false);
    }
  };

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
          <Label htmlFor="registered-name" className="text-slate-800">{role === "school" ? "School name" : "Registered name"}</Label>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="registered-name"
              value={nameValue}
              maxLength={80}
              onChange={(e) => setNameDraft(e.target.value)}
              className="min-w-[200px] flex-1 bg-white text-slate-900"
              aria-describedby="registered-name-note"
            />
            <Button type="button" onClick={() => void commitName()} disabled={!nameDirty || nameSaving} className="min-h-[44px]">
              {nameSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save name
            </Button>
          </div>
          <p id="registered-name-note" className="text-xs text-slate-500">
            {role === "school" ? "Your school's name. Your Academia is renamed to match." : "Your full name, as your teachers and school see it."}
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
