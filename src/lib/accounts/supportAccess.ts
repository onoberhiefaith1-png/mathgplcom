/**
 * Consent-based support access helpers.
 *
 * A platform administrator may mint a session for another account only when
 * that person has turned the grant on (or the account is one the admin already
 * owns: their own login or a sandbox test account). Zooming in on a password
 * is never a substitute for that grant.
 */

export type SupportAccessStatus = "granted" | "pending" | "none";

export type SupportAccessAdminAction = "enter" | "request" | "pending";

export type SupportAccessLogEntry = {
  id: string;
  enteredAt: string;
  adminLabel: string;
};

export const SUPPORT_ACCESS_ACCOUNT_PATH = "/account#support-access";

export const SUPPORT_ACCESS_NOTIFICATION_SOURCE = "support_access";

export function canMintWorkspaceToken(opts: {
  adminUserId: string;
  targetUserId: string;
  isOwnTestAccount: boolean;
  grantAllowed: boolean;
}): boolean {
  if (!opts.adminUserId || !opts.targetUserId) return false;
  if (opts.targetUserId === opts.adminUserId) return true;
  if (opts.isOwnTestAccount) return true;
  return opts.grantAllowed === true;
}

export function supportAccessStatus(opts: {
  grantAllowed: boolean;
  pendingRequest: boolean;
  isOwnTestAccount?: boolean;
}): SupportAccessStatus {
  if (opts.grantAllowed || opts.isOwnTestAccount) return "granted";
  if (opts.pendingRequest) return "pending";
  return "none";
}

export function adminActionForStatus(
  status: SupportAccessStatus,
  opts?: { isOwnAccount?: boolean; isOwnTestAccount?: boolean },
): SupportAccessAdminAction {
  if (opts?.isOwnAccount || opts?.isOwnTestAccount) return "enter";
  if (status === "granted") return "enter";
  if (status === "pending") return "pending";
  return "request";
}

export function supportAccessStatusLabel(status: SupportAccessStatus): string {
  if (status === "granted") return "Access granted";
  if (status === "pending") return "Request sent";
  return "No access";
}

/** Exit a grant-backed visit as soon as the account holder turns the switch off. */
export function shouldExitWhenGrantRevoked(opts: {
  via: "grant" | "owned" | undefined;
  grantAllowed: boolean | null;
}): boolean {
  if (opts.via !== "grant") return false;
  return opts.grantAllowed !== true;
}

export function formatSupportAccessLogTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "Unknown time";
  return at.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function viewingAsLabel(info: { name: string; email?: string | null; role?: string }): string {
  const name = info.name.trim() || "this account";
  const email = info.email?.trim();
  if (email && email !== name) return `Viewing as ${name} (${email})`;
  return `Viewing as ${name}`;
}
