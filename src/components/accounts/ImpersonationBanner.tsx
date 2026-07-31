import { useEffect, useState } from "react";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";
import { activeImpersonation, endImpersonation, type ImpersonationInfo } from "@/lib/accounts/impersonation";

/**
 * Shown platform-wide while a platform administrator is inside another
 * account's workspace. Exit restores the administrator's own session.
 */
const ImpersonationBanner = () => {
  const [info, setInfo] = useState<ImpersonationInfo | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setInfo(activeImpersonation());
    const onStorage = () => setInfo(activeImpersonation());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!info) return null;

  const exit = async () => {
    setLeaving(true);
    try {
      await endImpersonation();
      window.location.assign("/admin");
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg">
      <ShieldAlert className="h-4 w-4" />
      <span className="truncate">
        Viewing {info.name} as {info.role.replace(/_/g, " ")}
      </span>
      <button
        type="button"
        onClick={exit}
        disabled={leaving}
        className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-3 py-1 transition hover:bg-primary-foreground/25 disabled:opacity-60"
      >
        {leaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        Exit workspace
      </button>
    </div>
  );
};

export default ImpersonationBanner;
