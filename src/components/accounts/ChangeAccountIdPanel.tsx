import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, IdCard, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CUSTOM_ID_MAX, CUSTOM_ID_MIN, customIdError } from "@/lib/accounts/customIdRules";
import { changeMyAccountId, checkAccountIdAvailable } from "@/lib/accounts/customId.functions";
import { useMathgplId } from "@/lib/accounts/useMathgplId";

/**
 * Choose your own sign-in ID.
 *
 * The permanent ID keeps working, so a chosen ID can never lock anybody out.
 */
const ChangeAccountIdPanel = () => {
  const { toast } = useToast();
  const { customId, mathgplId, refetch } = useMathgplId();
  const change = useServerFn(changeMyAccountId);
  const check = useServerFn(checkAccountIdAvailable);

  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const localProblem = value.trim() ? customIdError(value) : null;

  const runCheck = async () => {
    const id = value.trim();
    if (!id) return;
    if (localProblem) {
      setStatus({ ok: false, message: localProblem });
      return;
    }
    setChecking(true);
    try {
      const res = await check({ data: { customId: id } });
      setStatus({ ok: Boolean(res?.ok), message: res?.ok ? "That ID is available." : res?.message ?? "That ID is taken." });
    } catch (e) {
      setStatus({ ok: false, message: (e as Error).message });
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    const id = value.trim();
    if (localProblem) {
      toast({ title: "Choose a different ID", description: localProblem, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await change({ data: { customId: id } });
      if (!res?.ok) {
        setStatus({ ok: false, message: res?.message ?? "That ID is taken." });
        toast({ title: "Could not save that ID", description: res?.message, variant: "destructive" });
        return;
      }
      setValue("");
      setStatus({ ok: true, message: "Saved. Sign in with this ID from now on." });
      await refetch();
      toast({ title: "Your ID is updated", description: `Sign in with ${res.customId} and your password.` });
    } catch (e) {
      toast({ title: "Could not save that ID", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <IdCard className="h-4 w-4 text-slate-500" /> Your sign-in ID
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {customId
          ? `You sign in with ${customId}. You can change it here whenever you like.`
          : "Pick something short and memorable to sign in with, instead of your long ID."}
        {mathgplId ? ` Your permanent ID ${mathgplId} always keeps working.` : ""}
      </p>

      <div className="mt-4 space-y-2">
        <Label htmlFor="chosen-id" className="text-slate-700">New ID</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="chosen-id"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setStatus(null);
            }}
            onBlur={runCheck}
            minLength={CUSTOM_ID_MIN}
            maxLength={CUSTOM_ID_MAX}
            placeholder="e.g. mrs.adeyemi"
            autoComplete="off"
            className="min-w-[220px] flex-1 bg-white text-slate-900 placeholder:text-slate-400"
          />
          <Button type="button" variant="outline" onClick={runCheck} disabled={checking || !value.trim()} className="min-h-[44px]">
            {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Check
          </Button>
          <Button type="button" onClick={save} disabled={saving || !value.trim() || Boolean(localProblem)} className="min-h-[44px]">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save ID
          </Button>
        </div>
        <p className={`text-xs ${status ? (status.ok ? "text-emerald-600" : "text-red-600") : "text-slate-500"}`}>
          {status?.message ??
            localProblem ??
            `${CUSTOM_ID_MIN}–${CUSTOM_ID_MAX} characters: letters, numbers, dots, dashes or underscores.`}
        </p>
      </div>
    </section>
  );
};

export default ChangeAccountIdPanel;
