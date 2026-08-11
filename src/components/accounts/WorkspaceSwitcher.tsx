import { useState, useRef, useEffect } from "react";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { workspaceLabel } from "@/lib/accounts/workspace";

/**
 * Workspace Switcher — Personal / School A / School B.
 *
 * Switching changes the workspace context (building, navigation, students,
 * classes). It never signs the person out and never creates an account.
 */
const WorkspaceSwitcher = ({ compact }: { compact?: boolean }) => {
  const { workspaces, active, activeOrgId, switchTo, isLoading } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  // Nothing to switch between → no control at all.
  if (isLoading || workspaces.length < 2) return null;

  const choose = async (orgId: string) => {
    setBusy(true);
    try {
      await switchTo(orgId);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-sm text-foreground backdrop-blur transition hover:border-primary/50 ${
          compact ? "" : "sm:px-4"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
        <span className="max-w-[10rem] truncate">{active ? workspaceLabel(active) : "Workspace"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-border/60 bg-background/95 p-1 shadow-[0_18px_60px_hsl(var(--background)/0.7)] backdrop-blur"
        >
          {workspaces.map((workspace) => (
            <li key={workspace.orgId}>
              <button
                type="button"
                disabled={workspace.status !== "active"}
                onClick={() => void choose(workspace.orgId)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-primary/15 disabled:opacity-50"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-foreground">{workspaceLabel(workspace)}</span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {workspace.isOwner ? "My MathGPL" : "Shared workspace"}
                    {workspace.status !== "active" ? " · suspended" : ""}
                  </span>

                </span>
                {workspace.orgId === activeOrgId && <Check className="h-4 w-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
