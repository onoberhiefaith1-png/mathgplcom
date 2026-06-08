export type WorkspaceMode = "linear" | "substitution" | "parallel";

const TABS: { id: WorkspaceMode; label: string }[] = [
  { id: "linear", label: "Linear Workspace" },
  { id: "substitution", label: "Substitution Workspace" },
  { id: "parallel", label: "Parallel Workspace" },
];

export const WorkspaceTabs = ({
  mode,
  onChange,
}: {
  mode: WorkspaceMode;
  onChange: (m: WorkspaceMode) => void;
}) => (
  <div className="flex items-center gap-6">
    {TABS.map((t) => {
      const active = t.id === mode;
      return (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            "relative px-2 py-2 text-sm font-semibold tracking-wide transition",
            active ? "text-cyan-300" : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {t.label}
          {active && (
            <span className="absolute left-0 right-0 -bottom-[10px] h-[3px] rounded-full bg-cyan-400 shadow-[0_0_12px_hsl(200_90%_60%/0.6)]" />
          )}
        </button>
      );
    })}
  </div>
);

export default WorkspaceTabs;
