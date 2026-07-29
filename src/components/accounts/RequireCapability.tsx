import type { ReactNode } from "react";
import { useAccount } from "@/lib/accounts/useAccount";
import type { Capability } from "@/lib/accounts/roles";

/**
 * Renders children only when the signed-in role holds the capability.
 * Hidden features are never rendered as disabled controls.
 */
const RequireCapability = ({
  capability,
  children,
  fallback = null,
}: {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
}) => {
  const { can, isLoading } = useAccount();
  if (isLoading) return null;
  return <>{can(capability) ? children : fallback}</>;
};

export default RequireCapability;
