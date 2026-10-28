import { Building2, GraduationCap } from "lucide-react";

import { EmptyNote } from "@/components/workspace/DashboardParts";
import type { FamilyConnection } from "@/lib/family/family";

const when = (iso: string | null) =>
  iso
    ? `Connected ${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
    : "Connected";

/**
 * Schools or teachers connected to the family, each with how many of the
 * parent's children it covers. A parent never joins these workspaces — this is
 * a list of who teaches their children.
 */
const ConnectedList = ({
  kind,
  rows,
  empty,
}: {
  kind: "school" | "teacher";
  rows: FamilyConnection[];
  empty: string;
}) => {
  if (rows.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  const Icon = kind === "school" ? Building2 : GraduationCap;

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={`${row.kind}-${row.targetUserId}`}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-ws-border/60 bg-ws-canvas/40 p-3"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ws-gold/15 text-ws-gold">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{row.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {row.username ? `@${row.username} · ` : ""}
              {when(row.connectedAt)}
            </span>
          </span>
          <span className="shrink-0 rounded-full border border-ws-border/70 bg-ws-panel/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-ws-gold/90">
            {row.children} {row.children === 1 ? "child" : "children"}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default ConnectedList;
