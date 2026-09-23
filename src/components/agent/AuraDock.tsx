// Phase 3 — where the cockpit lives: beside the platform on every page, for a
// signed-in teacher only, with the page itself giving up the panel's width on
// wide screens so the two sides sit next to each other.

import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { AuraProvider, useAura } from "@/lib/agent/AuraProvider";

import AuraCockpit from "./AuraCockpit";
import AuraLauncher from "./AuraLauncher";
import AuraMicPermission from "./AuraMicPermission";
import AuraWakeWord from "./AuraWakeWord";

function DockShell({ children }: { children: ReactNode }) {
  const { open, width } = useAura();
  return (
    <>
      <div
        className="min-w-0 transition-[padding] duration-200"
        style={open ? { paddingRight: `var(--aura-dock, 0px)` } : undefined}
      >
        {/* The reservation is only applied from the small breakpoint up; on a
            phone and a tablet the cockpit covers the page as a sheet instead. */}
        <style>{`@media (min-width:1024px){:root{--aura-dock:${open ? width : 0}px}}@media (max-width:1023px){:root{--aura-dock:0px}}`}</style>
        {children}
      </div>
      <AuraCockpit />
      <AuraLauncher />
      <AuraWakeWord />
      <AuraMicPermission />
    </>
  );
}

export default function AuraDock({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const { role, isPlatformOwner } = useAccount();
  const { archived, loading } = useArchivedFeature(AURA_FEATURE_KEY);

  // Visitors and the sign-in screens keep the platform exactly as it was.
  if (!ready || !session) return <>{children}</>;

  // Aura is archived: she is not mounted anywhere on the teaching side. Only
  // the platform administration account can still reach her, and only while the
  // archive switch is turned off in the console.
  const admin = isPlatformOwner || role === "platform_owner" || role === "co_admin";
  if (!admin || loading || archived !== false) return <>{children}</>;

  return (
    <AuraProvider>
      <DockShell>{children}</DockShell>
    </AuraProvider>
  );
}
