import { Loader2, LogIn, Send } from "lucide-react";
import {
  adminActionForStatus,
  supportAccessStatusLabel,
  type SupportAccessStatus,
} from "@/lib/accounts/supportAccess";

const actionClass =
  "inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-dash-border px-2.5 py-1.5 text-xs font-medium text-dash-surface-foreground transition hover:border-dash-gold hover:bg-dash-gold/10 disabled:opacity-50";

export type SupportAccessAdminControlsProps = {
  status: SupportAccessStatus;
  isMine?: boolean;
  isOwnAccount?: boolean;
  busy?: boolean;
  onEnter: () => void;
  onRequest: () => void;
  className?: string;
};

/**
 * Admin console controls: Enter when access is granted (or this is the
 * admin's own / test account), otherwise Request access.
 */
const SupportAccessAdminControls = ({
  status,
  isMine,
  isOwnAccount,
  busy,
  onEnter,
  onRequest,
  className,
}: SupportAccessAdminControlsProps) => {
  const action = adminActionForStatus(status, {
    isOwnAccount,
    isOwnTestAccount: isMine,
  });
  const label =
    isMine || isOwnAccount ? "Your account" : supportAccessStatusLabel(status);

  return (
    <div className={`flex flex-wrap items-center justify-end gap-1.5 ${className ?? ""}`}>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          action === "enter"
            ? "bg-emerald-500/15 text-emerald-700"
            : action === "pending"
              ? "bg-amber-500/15 text-amber-800"
              : "bg-slate-500/10 text-dash-surface-muted"
        }`}
      >
        {label}
      </span>
      {action === "enter" ? (
        <button type="button" className={actionClass} disabled={busy} onClick={onEnter}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
          Enter account
        </button>
      ) : action === "pending" ? (
        <button type="button" className={actionClass} disabled>
          Request sent
        </button>
      ) : (
        <button type="button" className={actionClass} disabled={busy} onClick={onRequest}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Request access
        </button>
      )}
    </div>
  );
};

export default SupportAccessAdminControls;
