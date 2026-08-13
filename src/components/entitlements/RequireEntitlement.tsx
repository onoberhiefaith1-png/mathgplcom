import type { ReactNode } from "react";

import UpgradeNotice from "./UpgradeNotice";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { upgradeMessage, type FeatureKey } from "@/lib/entitlements/features";

/**
 * Renders a protected area only when the account's plan (or a paying
 * connection) grants the entitlement. Otherwise the customer reads a plain
 * upgrade message instead of hitting a dead button.
 */
const RequireEntitlement = ({
  feature,
  children,
  fallback,
  compact = false,
}: {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  compact?: boolean;
}) => {
  const { has, loading, labelOf } = useEntitlements();
  if (loading) return null;
  if (has(feature)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <div className="px-6 py-10">
      <UpgradeNotice message={upgradeMessage(feature, labelOf(feature))} compact={compact} />
    </div>
  );
};

export default RequireEntitlement;
