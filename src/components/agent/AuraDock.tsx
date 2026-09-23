// Phase 3 — where the cockpit lives: beside the platform on every page, for a
// signed-in teacher only, with the page itself giving up the panel's width on
// wide screens so the two sides sit next to each other.

import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { AuraProvider, useAura } from "@/lib/agent/AuraProvider";

import AuraCockpit from "./AuraCockpit";
import AuraLauncher from "./AuraLauncher";

function DockShell({ children }: { children: ReactNode }) {
  const { open, width } = useAura();
  return (
    <>
      <div
        className="min-w-0 transition-[padding] duration-200"
        style={open ? { paddingRight: `var(--aura-dock, 0px)` } : undefined}
      >
        {/* The reservation is only applied from the small breakpoint up; on a
            phone the cockpit covers the page as a sheet instead. */}
        <style>{`@media (min-width:640px){:root{--aura-dock:${open ? width : 0}px}}@media (max-width:639px){:root{--aura-dock:0px}}`}</style>
        {children}
      </div>
      <AuraCockpit />
      <AuraLauncher />
    </>
  );
}

export default function AuraDock({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();

  // Visitors and the sign-in screens keep the platform exactly as it was.
  if (!ready || !session) return <>{children}</>;

  return (
    <AuraProvider>
      <DockShell>{children}</DockShell>
    </AuraProvider>
  );
}
