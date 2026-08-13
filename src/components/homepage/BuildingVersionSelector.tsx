import { useEffect, useState } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { Building2, Loader2, Megaphone } from "lucide-react";

import { useAccount } from "@/lib/accounts/useAccount";
import {
  ensurePlatformFreeSeeded,
  type HomepageConfigMode,
} from "@/lib/homepage/homepageConfig";
import { cn } from "@/lib/utils";

export type BuildingVersion = "pro" | "free";

/**
 * Which building version the customization pages are editing.
 *
 * "pro" is this account's own building (unchanged behaviour for everyone).
 * "free" is the platform-owned Free/advertisement building and is only ever
 * offered to the platform owner.
 */
export function useBuildingVersion(): {
  version: BuildingVersion;
  setVersion: (v: BuildingVersion) => void;
  configMode: HomepageConfigMode;
  canSwitch: boolean;
  seeding: boolean;
} {
  const { isPlatformOwner } = useAccount();
  const [params, setParams] = useSearchParams();
  const requested = params.get("version") === "free" ? "free" : "pro";
  const version: BuildingVersion = isPlatformOwner ? requested : "pro";
  const [seeding, setSeeding] = useState(false);

  // The Free building starts life as an exact copy of the Pro building.
  useEffect(() => {
    if (version !== "free" || !isPlatformOwner) return;
    let alive = true;
    setSeeding(true);
    void ensurePlatformFreeSeeded().finally(() => {
      if (alive) setSeeding(false);
    });
    return () => {
      alive = false;
    };
  }, [version, isPlatformOwner]);

  const setVersion = (v: BuildingVersion) => {
    const next = new URLSearchParams(params);
    if (v === "free") next.set("version", "free");
    else next.delete("version");
    setParams(next, { replace: true });
  };

  return {
    version,
    setVersion,
    configMode: version === "free" ? "platform-free" : "self",
    canSwitch: isPlatformOwner,
    seeding,
  };
}

/** Pro / Free switch shown on the customization pages, platform owner only. */
const BuildingVersionSelector = ({
  version,
  onChange,
  seeding,
}: {
  version: BuildingVersion;
  onChange: (v: BuildingVersion) => void;
  seeding?: boolean;
}) => {
  const options: { value: BuildingVersion; label: string; hint: string; Icon: typeof Building2 }[] = [
    { value: "pro", label: "Pro Building", hint: "Paid accounts. No advertising.", Icon: Building2 },
    { value: "free", label: "Free Building", hint: "Free accounts and Community. Carries the billboard.", Icon: Megaphone },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Building version
        </p>
        {seeding && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={version === opt.value}
            className={cn(
              "rounded-xl border p-3 text-left transition",
              version === opt.value
                ? "border-primary bg-primary/10"
                : "border-border/60 bg-background/40 hover:border-primary/50",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <opt.Icon className="h-4 w-4 text-primary" />
              {opt.label}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{opt.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BuildingVersionSelector;
