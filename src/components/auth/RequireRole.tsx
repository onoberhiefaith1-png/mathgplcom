import type { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Link } from "@/lib/router-compat";

import RequireAuth from "@/components/auth/RequireAuth";
import { useAccount } from "@/lib/accounts/useAccount";
import { WORKSPACE_LABEL, WORKSPACE_PATH, type AppRole } from "@/lib/accounts/roles";

/**
 * One workspace area, one set of account types.
 *
 * A signed-in person may only open the area that belongs to their stored
 * account type. Typing another area's address never opens another account
 * type's workspace — it explains the situation and offers the way back to
 * their own. The database policies enforce the same boundary for data.
 */
const RequireRole = ({ roles, children }: { roles: AppRole[]; children: ReactNode }) => (
  <RequireAuth>
    <RoleGate roles={roles}>{children}</RoleGate>
  </RequireAuth>
);

const RoleGate = ({ roles, children }: { roles: AppRole[]; children: ReactNode }) => {
  const { role, isLoading, roleMissing } = useAccount();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (role && roles.includes(role)) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldAlert className="h-8 w-8 text-amber-400" />
      <h1 className="text-xl font-semibold">Not available for this account</h1>
      {roleMissing ? (
        <p className="text-sm text-muted-foreground">
          Your account configuration is incomplete — no account type is set yet. Please contact
          MathGPL support so your account can be set up correctly.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          This area belongs to a different kind of account. Your account opens its own workspace
          instead.
        </p>
      )}
      {role && (
        <Link
          to={WORKSPACE_PATH[role]}
          className="inline-flex min-h-[44px] items-center rounded-full border border-primary/40 px-5 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          Open {WORKSPACE_LABEL[role]}
        </Link>
      )}
      <Link to="/" className="text-sm text-muted-foreground underline">
        Back to the Building
      </Link>
    </div>
  );
};

export default RequireRole;
