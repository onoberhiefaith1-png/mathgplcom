import { useState } from "react";
import { Building2, Check, Copy, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSchoolCode } from "@/lib/connections/useConnections";

/**
 * The School Code.
 *
 * Discovery and codes are the two routes into a school. A teacher or student
 * who has this code can ask to join without searching the Community — but the
 * code only creates a *request*: the school still decides. It is not a
 * password and it can never sign anybody in.
 */
export const SchoolCodeCard = () => {
  const { school, loading, regenerate, regenerating } = useSchoolCode();
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Loading your School Code…
      </section>
    );
  }
  if (!school) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(school.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <Building2 className="h-4 w-4 text-slate-500" /> {school.name} — School Code
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Give this code to a teacher or a student so they can ask to join {school.name}. They send a
        request; you decide. The code is not a password and cannot be used to sign in.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 font-mono text-lg tracking-[0.2em] text-slate-900">
          {school.code}
        </span>
        <Button type="button" variant="outline" onClick={copy} className="min-h-[44px]">
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void regenerate(school.orgId)}
          disabled={regenerating}
          className="min-h-[44px] text-slate-600"
        >
          {regenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          New code
        </Button>
      </div>
    </section>
  );
};

export default SchoolCodeCard;
