import { Loader2, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSupportAccess } from "@/lib/accounts/useSupportAccess";
import { formatSupportAccessLogTime, type SupportAccessLogEntry } from "@/lib/accounts/supportAccess";
import { useToast } from "@/hooks/use-toast";

export type SupportAccessSectionProps = {
  /** When set, render these values instead of loading from the signed-in account (previews). */
  preview?: {
    allowed: boolean;
    pending: { id: string; createdAt: string }[];
    log: SupportAccessLogEntry[];
  };
};

/**
 * Account-page section: the person turns support access on or off, answers a
 * request, and can see when a platform administrator last entered.
 */
const SupportAccessSection = ({ preview }: SupportAccessSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const live = useSupportAccess(preview ? undefined : user?.id);
  const allowed = preview?.allowed ?? live.allowed;
  const pending = preview?.pending ?? live.pending;
  const log = preview?.log ?? live.log;
  const loading = preview ? false : live.loading;
  const saving = preview ? false : live.saving;

  const toggle = async (next: boolean) => {
    if (preview) return;
    try {
      await live.setGrant(next);
      toast({
        title: next ? "Admin access allowed" : "Admin access turned off",
        description: next
          ? "A platform administrator can enter your account without your password, until you turn this off."
          : "A platform administrator can no longer enter your account.",
      });
    } catch (error) {
      toast({
        title: "Could not update support access",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const answer = async (requestId: string, status: "allowed" | "denied") => {
    if (preview) return;
    try {
      await live.respond(requestId, status);
      toast({
        title: status === "allowed" ? "Access allowed" : "Request denied",
        description:
          status === "allowed"
            ? "A platform administrator can enter your account until you turn this off."
            : "The administrator was not given access.",
      });
    } catch (error) {
      toast({
        title: "Could not answer that request",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <section
      id="support-access"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <ShieldCheck className="h-4 w-4 text-amber-500" /> Support access
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Allow a platform administrator to enter your account and see a problem the way you see it.
        They will not need your password. Turn this off at any time to lock them out.
      </p>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading support access…
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Allow admin to enter my account</p>
              <p className="mt-0.5 text-xs text-slate-600">
                {allowed
                  ? "Access is on. A platform administrator can enter until you turn this off."
                  : "Access is off. An administrator can send you a request, or you can turn this on yourself."}
              </p>
            </div>
            <Switch
              checked={allowed}
              disabled={saving}
              onCheckedChange={(next) => void toggle(next)}
              aria-label="Allow admin to enter my account"
            />
          </div>

          {pending.length > 0 && (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Requests waiting for you</h3>
              {pending.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm text-slate-700">
                    A platform administrator asked for access
                    {request.createdAt ? ` on ${formatSupportAccessLogTime(request.createdAt)}` : ""}.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="min-h-[44px]"
                      disabled={saving}
                      onClick={() => void answer(request.id, "allowed")}
                    >
                      Allow
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[44px]"
                      disabled={saving}
                      onClick={() => void answer(request.id, "denied")}
                    >
                      Deny
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-900">When an administrator entered</h3>
            {log.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">No one has entered your account this way yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {log.map((entry) => (
                  <li key={entry.id}>
                    {entry.adminLabel} entered on {formatSupportAccessLogTime(entry.enteredAt)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default SupportAccessSection;
